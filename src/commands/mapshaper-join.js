/* @require mapshaper-common */

// Function uses async callback because csv parser is asynchronous
// TODO: switch to synchronous
//
api.importJoinTableAsync = function(file, opts, done) {
  MapShaper.importTableAsync(file, function(table) {
    var fields = opts.fields || table.getFields(),
        keys = opts.keys;
    if (!Utils.isArray(keys) || keys.length != 2) {
      stop("[join] Invalid join keys:", keys);
    }

    // this may cause duplicate field name with inconsistent type hints
    // adjustRecordTypes() should handle this case
    fields.push(opts.keys[1]);
    // convert data types based on type hints and numeric csv fields
    // side effect: type hints are removed from field names
    // TODO: remove side effect
    fields = MapShaper.adjustRecordTypes(table.getRecords(), fields);
    // replace foreign key in case original contained type hint
    opts.keys[1] = fields.pop();
    opts.fields = fields;
    done(table);
  }, opts);
};

api.joinAttributesToFeatures = function(lyr, table, opts) {
  var localKey = opts.keys[0],
      foreignKey = opts.keys[1],
      joinFields = opts.fields,
      typeIndex = {};

  if (table.fieldExists(foreignKey) === false) {
    stop("[join] External table is missing a field named:", foreignKey);
  }

  if (opts.where) {
    table = MapShaper.filterDataTable(table, opts.where);
  }

  if (!joinFields || joinFields.length === 0) {
    joinFields = Utils.difference(table.getFields(), [foreignKey]);
  }

  // var index = Utils.indexOn(table.getRecords(), foreignKey);

  if (!lyr.data || !lyr.data.fieldExists(localKey)) {
    error("[join] Target layer is missing field:", localKey);
  }

  if (!MapShaper.joinTables(lyr.data, localKey, joinFields, table, foreignKey,
      joinFields)) error("[join] No records could be joined");
  // TODO: better handling of failed joins
};

MapShaper.joinTables = function(dest, destKey, destFields, src, srcKey, srcFields) {
  var hits = 0, misses = 0,
      records = dest.getRecords(),
      len = records.length,
      destField, srcField,
      unmatched = [],
      nullRec = Utils.newArray(destFields.length, null),
      destRec, srcRec, joinVal;
  src.indexOn(srcKey);

  for (var i=0; i<len; i++) {
    destRec = records[i];
    joinVal = destRec[destKey];
    srcRec = src.getIndexedRecord(joinVal);
    if (!srcRec) {
      misses++;
      if (misses <= 10) unmatched.push(joinVal);
      srcRec = nullRec;
    } else {
      hits++;
    }
    for (var j=0, n=srcFields.length; j<n; j++) {
      destRec[destFields[j]] = srcRec[srcFields[j]] || null;
    }
  }
  if (misses > 0) {
    var msg;
    if (misses > 10) {
      msg = Utils.format("Unable to join %d records", misses);
    } else {
      msg = Utils.format("Unjoined values: %s", Utils.uniq(unmatched).join(', '));
    }
    message(msg);
  }

  return hits > 0;
};
