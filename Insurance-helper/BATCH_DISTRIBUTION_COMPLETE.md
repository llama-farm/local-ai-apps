# Batch Distribution Complete ✅

Your 298 insurance policy PDFs have been distributed into 10 batches!

## Distribution Summary

```
Batch 1:  30 files  → data/UHC/batch_1/
Batch 2:  30 files  → data/UHC/batch_2/
Batch 3:  30 files  → data/UHC/batch_3/
Batch 4:  30 files  → data/UHC/batch_4/
Batch 5:  30 files  → data/UHC/batch_5/
Batch 6:  30 files  → data/UHC/batch_6/
Batch 7:  30 files  → data/UHC/batch_7/
Batch 8:  30 files  → data/UHC/batch_8/
Batch 9:  30 files  → data/UHC/batch_9/
Batch 10: 28 files  → data/UHC/batch_10/
---
Total:    298 files
```

## Next Steps - Upload & Process

Run these commands to upload and process each batch:

### Process Batch 1
```bash
cd Insurance-helper
lf datasets ingest insurance_policies_batch_1 ./data/UHC/batch_1/*.pdf
lf datasets process insurance_policies_batch_1
```

**Wait for completion (~10-15 minutes), then continue with Batch 2:**

### Process Batch 2
```bash
lf datasets ingest insurance_policies_batch_2 ./data/UHC/batch_2/*.pdf
lf datasets process insurance_policies_batch_2
```

### Process Batch 3
```bash
lf datasets ingest insurance_policies_batch_3 ./data/UHC/batch_3/*.pdf
lf datasets process insurance_policies_batch_3
```

### Process Batch 4
```bash
lf datasets ingest insurance_policies_batch_4 ./data/UHC/batch_4/*.pdf
lf datasets process insurance_policies_batch_4
```

### Process Batch 5
```bash
lf datasets ingest insurance_policies_batch_5 ./data/UHC/batch_5/*.pdf
lf datasets process insurance_policies_batch_5
```

### Process Batch 6
```bash
lf datasets ingest insurance_policies_batch_6 ./data/UHC/batch_6/*.pdf
lf datasets process insurance_policies_batch_6
```

### Process Batch 7
```bash
lf datasets ingest insurance_policies_batch_7 ./data/UHC/batch_7/*.pdf
lf datasets process insurance_policies_batch_7
```

### Process Batch 8
```bash
lf datasets ingest insurance_policies_batch_8 ./data/UHC/batch_8/*.pdf
lf datasets process insurance_policies_batch_8
```

### Process Batch 9
```bash
lf datasets ingest insurance_policies_batch_9 ./data/UHC/batch_9/*.pdf
lf datasets process insurance_policies_batch_9
```

### Process Batch 10
```bash
lf datasets ingest insurance_policies_batch_10 ./data/UHC/batch_10/*.pdf
lf datasets process insurance_policies_batch_10
```

## Monitor Progress

```bash
# Check dataset status
lf datasets list

# Check total embeddings created
lf rag stats --database insurance_policies_db

# Test query
lf rag query --database insurance_policies_db "deductible coverage"
```

## Timeline Estimate

- **Per batch**: ~10-15 minutes (30 PDFs)
- **Total for all 10 batches**: ~2-2.5 hours (if done sequentially)

## Tips

1. **Process sequentially** to avoid overwhelming the server
2. **Check completion** before starting next batch: `lf datasets list`
3. **Monitor resources**: Check Docker memory if processing slows down
4. **All batches → ONE database**: They all add to `insurance_policies_db`

---

**Ready to start processing! Begin with Batch 1 above.**
