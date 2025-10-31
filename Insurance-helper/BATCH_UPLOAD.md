# Batch Upload Instructions

You now have **10 datasets** configured, all sharing the same database (`insurance_policies_db`).

## Directory Structure

```
Insurance-helper/data/UHC/
├── batch_1/     (place ~30 PDFs here)
├── batch_2/     (place ~30 PDFs here)
├── batch_3/     (place ~30 PDFs here)
├── batch_4/     (place ~30 PDFs here)
├── batch_5/     (place ~30 PDFs here)
├── batch_6/     (place ~30 PDFs here)
├── batch_7/     (place ~30 PDFs here)
├── batch_8/     (place ~30 PDFs here)
├── batch_9/     (place ~30 PDFs here)
└── batch_10/    (place remaining PDFs here)
```

## Upload Commands

After distributing your PDFs into the batch directories, run these commands:

### Batch 1
```bash
cd Insurance-helper
lf datasets ingest insurance_policies_batch_1 ./data/UHC/batch_1/*.pdf
lf datasets process insurance_policies_batch_1
```

### Batch 2
```bash
lf datasets ingest insurance_policies_batch_2 ./data/UHC/batch_2/*.pdf
lf datasets process insurance_policies_batch_2
```

### Batch 3
```bash
lf datasets ingest insurance_policies_batch_3 ./data/UHC/batch_3/*.pdf
lf datasets process insurance_policies_batch_3
```

### Batch 4
```bash
lf datasets ingest insurance_policies_batch_4 ./data/UHC/batch_4/*.pdf
lf datasets process insurance_policies_batch_4
```

### Batch 5
```bash
lf datasets ingest insurance_policies_batch_5 ./data/UHC/batch_5/*.pdf
lf datasets process insurance_policies_batch_5
```

### Batch 6
```bash
lf datasets ingest insurance_policies_batch_6 ./data/UHC/batch_6/*.pdf
lf datasets process insurance_policies_batch_6
```

### Batch 7
```bash
lf datasets ingest insurance_policies_batch_7 ./data/UHC/batch_7/*.pdf
lf datasets process insurance_policies_batch_7
```

### Batch 8
```bash
lf datasets ingest insurance_policies_batch_8 ./data/UHC/batch_8/*.pdf
lf datasets process insurance_policies_batch_8
```

### Batch 9
```bash
lf datasets ingest insurance_policies_batch_9 ./data/UHC/batch_9/*.pdf
lf datasets process insurance_policies_batch_9
```

### Batch 10
```bash
lf datasets ingest insurance_policies_batch_10 ./data/UHC/batch_10/*.pdf
lf datasets process insurance_policies_batch_10
```

## One-Liner for Each Batch

If you want to run ingest + process in one command:

```bash
# Batch 1
lf datasets ingest insurance_policies_batch_1 ./data/UHC/batch_1/*.pdf && lf datasets process insurance_policies_batch_1

# Batch 2
lf datasets ingest insurance_policies_batch_2 ./data/UHC/batch_2/*.pdf && lf datasets process insurance_policies_batch_2

# Batch 3
lf datasets ingest insurance_policies_batch_3 ./data/UHC/batch_3/*.pdf && lf datasets process insurance_policies_batch_3

# Batch 4
lf datasets ingest insurance_policies_batch_4 ./data/UHC/batch_4/*.pdf && lf datasets process insurance_policies_batch_4

# Batch 5
lf datasets ingest insurance_policies_batch_5 ./data/UHC/batch_5/*.pdf && lf datasets process insurance_policies_batch_5

# Batch 6
lf datasets ingest insurance_policies_batch_6 ./data/UHC/batch_6/*.pdf && lf datasets process insurance_policies_batch_6

# Batch 7
lf datasets ingest insurance_policies_batch_7 ./data/UHC/batch_7/*.pdf && lf datasets process insurance_policies_batch_7

# Batch 8
lf datasets ingest insurance_policies_batch_8 ./data/UHC/batch_8/*.pdf && lf datasets process insurance_policies_batch_8

# Batch 9
lf datasets ingest insurance_policies_batch_9 ./data/UHC/batch_9/*.pdf && lf datasets process insurance_policies_batch_9

# Batch 10
lf datasets ingest insurance_policies_batch_10 ./data/UHC/batch_10/*.pdf && lf datasets process insurance_policies_batch_10
```

## Processing Strategy

**Recommended approach:**

1. **Process batches sequentially** to avoid overwhelming the server
2. Each batch takes ~10-30 minutes depending on number/size of PDFs
3. Monitor with: `lf datasets list` and `lf rag stats --database insurance_policies_db`

**Process one at a time:**
```bash
# Start batch 1
lf datasets ingest insurance_policies_batch_1 ./data/UHC/batch_1/*.pdf
lf datasets process insurance_policies_batch_1

# Wait for completion, then batch 2
lf datasets ingest insurance_policies_batch_2 ./data/UHC/batch_2/*.pdf
lf datasets process insurance_policies_batch_2

# ... and so on
```

## Checking Status

```bash
# Check which batches have been processed
lf datasets list

# Check total embeddings in database
lf rag stats --database insurance_policies_db

# Check a specific dataset
lf datasets status insurance_policies_batch_1
```

## Key Points

✅ **All batches share ONE database**: `insurance_policies_db`  
✅ **No duplication**: Each batch adds to the same ChromaDB collection  
✅ **Sequential processing recommended**: Prevents server overload  
✅ **Can process multiple**: If your server can handle it, process 2-3 in parallel

## Troubleshooting

**If processing fails:**
```bash
# Check LlamaFarm logs
lf logs

# Restart LlamaFarm
lf restart

# Re-process failed batch
lf datasets process insurance_policies_batch_X
```

**If server is overwhelmed:**
- Process fewer batches in parallel
- Reduce batch size (split into more batches)
- Increase Docker memory allocation

---

**After processing all batches, all documents will be searchable from the same `insurance_policies_db` database!**
