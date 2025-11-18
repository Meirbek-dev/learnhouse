# Chunked File Upload Implementation

## Overview

This implementation solves the nginx `413 Content Too Large` error by implementing chunked file
uploads. Large files are split into smaller chunks (default 5MB) and uploaded sequentially,
bypassing nginx request size limits.

## Architecture

### Backend (Python/FastAPI)

#### 1. **Chunked Upload Utility** (`src/services/utils/chunked_upload.py`)

- Manages upload sessions with unique IDs
- Handles chunk storage and assembly
- Validates chunk integrity
- Cleans up temporary files

#### 2. **Upload Endpoints** (`src/routers/uploads/chunked_upload.py`)

- `POST /api/v1/uploads/initiate` - Start a new upload session
- `POST /api/v1/uploads/chunk` - Upload individual chunks
- `POST /api/v1/uploads/complete` - Finalize and assemble chunks
- `GET /api/v1/uploads/status/{upload_id}` - Check upload progress
- `DELETE /api/v1/uploads/{upload_id}` - Cancel and cleanup

### Frontend (TypeScript/React)

#### 1. **Chunked Upload Utility** (`services/utils/chunked-upload.ts`)

- Splits files into configurable chunks (default 5MB)
- Uploads chunks sequentially with progress tracking
- Automatic retry logic
- Progress callbacks for UI updates

#### 2. **Updated Services**

- `services/blocks/Video/video.ts` - Smart upload (chunked for large files, traditional for small)
- `services/courses/activities.ts` - Progress tracking with XMLHttpRequest

## Usage

### Backend API

```python
# 1. Initiate upload
POST /api/v1/uploads/initiate
{
  "directory": "courses/xxx/activities/yyy/video",
  "type_of_dir": "orgs",
  "uuid": "org_uuid",
  "filename": "video.mp4",
  "total_chunks": 20,
  "file_size": 104857600
}
# Returns: { "upload_id": "01JHXXX..." }

# 2. Upload chunks (repeat for each chunk)
POST /api/v1/uploads/chunk
{
  "upload_id": "01JHXXX...",
  "chunk_index": 0,
  "chunk": <binary data>
}

# 3. Complete upload
POST /api/v1/uploads/complete
{
  "upload_id": "01JHXXX..."
}
# Returns: { "success": true, "filename": "video.mp4", "file_size": 104857600 }
```

### Frontend Usage

```typescript
import { uploadFileChunked, shouldUseChunkedUpload } from '@services/utils/chunked-upload';

// Check if file needs chunked upload
if (shouldUseChunkedUpload(file.size)) {
  // Use chunked upload for large files
  const result = await uploadFileChunked({
    file,
    directory: 'courses/xxx/activities/yyy/video',
    typeOfDir: 'orgs',
    uuid: orgUuid,
    filename: 'video.mp4',
    accessToken: token,
    onProgress: (progress) => {
      console.log(`Upload progress: ${progress.percentage}%`);
      console.log(`Chunk ${progress.currentChunk}/${progress.totalChunks}`);
    },
  });
}
```

## Configuration

### Chunk Size

Default: **5MB** per chunk

Adjust in `services/utils/chunked-upload.ts`:

```typescript
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
```

### Threshold for Chunked Upload

Default: Files **> 10MB** use chunked upload

Adjust in `shouldUseChunkedUpload()`:

```typescript
const THRESHOLD = 10 * 1024 * 1024; // 10MB
```

## Features

### ✅ **Implemented**

- Chunked file upload with sequential processing
- Progress tracking with callbacks
- Automatic session cleanup
- Error handling and validation
- Smart upload selection (chunked vs traditional)
- File size validation
- Temporary file management

### 🔄 **Automatic Behavior**

- Files > 10MB automatically use chunked upload
- Files ≤ 10MB use traditional upload (better performance)
- Progress updates during upload
- Automatic cleanup on completion or error

### 🛡️ **Safety Features**

- Chunk integrity validation
- File size verification after assembly
- Session-based upload tracking
- Automatic temp file cleanup
- Error recovery

## Error Handling

### Common Errors

1. **413 Content Too Large** - SOLVED ✅
   - Now uploads in chunks, bypassing nginx limits

2. **Chunk Upload Failed**
   - Individual chunks can be retried
   - Session remains valid for retry

3. **Assembly Failed**
   - Validates all chunks received
   - Verifies assembled file size

## Nginx Configuration (Optional)

While this implementation bypasses nginx limits, you can still adjust them:

```nginx
# /etc/nginx/nginx.conf
http {
    client_max_body_size 10M;  # Allow up to 10MB for non-chunked uploads
}
```

## Performance Considerations

### Chunk Size Trade-offs

**Smaller Chunks (1-2MB)**

- ✅ More resilient to network issues
- ✅ Better progress granularity
- ❌ More HTTP requests (overhead)

**Larger Chunks (10-20MB)**

- ✅ Fewer HTTP requests
- ✅ Faster for stable connections
- ❌ Larger retry cost on failure
- ❌ May hit nginx limits

**Recommended: 5MB** (default)

- Good balance for most scenarios
- Works well with default nginx configs
- Reasonable progress updates

## Production Recommendations

### 1. **Use Redis for Session Storage**

Replace in-memory `_upload_sessions` dict with Redis:

```python
import redis
redis_client = redis.Redis(host='localhost', port=6379)

# Store session
redis_client.setex(
    f"upload:{upload_id}",
    3600,  # 1 hour expiry
    json.dumps(session_data)
)
```

### 2. **Add Background Cleanup Job**

Clean up abandoned uploads:

```python
# Cron job to clean old temp files
@scheduler.scheduled_job('interval', hours=1)
def cleanup_old_uploads():
    cutoff = datetime.now() - timedelta(hours=1)
    for upload_dir in Path('temp_uploads').iterdir():
        if upload_dir.stat().st_mtime < cutoff.timestamp():
            shutil.rmtree(upload_dir)
```

### 3. **Add Rate Limiting**

Prevent abuse:

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@router.post("/chunk", dependencies=[Depends(RateLimiter(times=100, seconds=60))])
```

### 4. **Monitor Upload Metrics**

Track upload success/failure rates, chunk counts, and durations.

## Testing

### Test Large File Upload

```bash
# Create a test video file (100MB)
dd if=/dev/zero of=test_video.mp4 bs=1M count=100

# Upload via frontend
# Should automatically use chunked upload and show progress
```

### Verify Chunk Assembly

```python
# Check assembled file integrity
import hashlib

def verify_file_integrity(original_file, assembled_file):
    hash1 = hashlib.md5(open(original_file, 'rb').read()).hexdigest()
    hash2 = hashlib.md5(open(assembled_file, 'rb').read()).hexdigest()
    assert hash1 == hash2, "File integrity check failed"
```

## Migration Notes

### Existing Code Compatibility

✅ **Backward Compatible**

- Traditional uploads still work for small files
- Automatic selection based on file size
- No breaking changes to existing APIs

### Gradual Rollout

1. Deploy backend changes
2. Test chunked upload endpoint
3. Deploy frontend changes
4. Monitor upload success rates
5. Adjust chunk size if needed

## Troubleshooting

### Issue: Uploads still failing with 413

**Solution:** Check if request is hitting chunked endpoint

```bash
# Should see: POST /api/v1/uploads/chunk
# Not: POST /api/v1/activities/video
```

### Issue: Slow upload speed

**Solution:** Increase chunk size or enable parallel uploads

```typescript
// Increase chunk size
const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
```

### Issue: Disk space filling up

**Solution:** Implement automatic cleanup

- Add cron job for temp file cleanup
- Set shorter session expiry times
- Monitor `temp_uploads/` directory

## Summary

This implementation provides a robust, production-ready solution for uploading large video files
while maintaining compatibility with existing code. The automatic selection between chunked and
traditional uploads ensures optimal performance for all file sizes.

**Key Benefits:**

- ✅ Solves 413 Content Too Large errors
- ✅ Progress tracking for better UX
- ✅ Automatic cleanup and error handling
- ✅ Backward compatible
- ✅ Production-ready with scaling recommendations
