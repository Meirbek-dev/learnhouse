# OpenU Backup Configuration

This document describes the automated backup system configured for the OpenU platform using
[docker-volume-backup](https://github.com/offen/docker-volume-backup).

## Overview

The backup system automatically creates compressed archives of all critical data volumes on a
scheduled basis. Backups are stored locally and can optionally be uploaded to remote storage (S3,
Azure, Dropbox, etc.).

## What Gets Backed Up

The following Docker volumes are included in backups:

- **postgres_data** - PostgreSQL database
- **redis_data** - Redis cache and session data
- **chromadb_data** - ChromaDB vector database
- **app_content** - User uploads and organization data
- **app_logs** - Application logs

## Backup Schedule

- **Frequency**: Daily at 2:00 AM
- **Retention**: 7 days (automatically deletes older backups)
- **Compression**: Zstandard (zstd) - faster and more efficient than gzip
- **Format**: `backup-openu-YYYY-MM-DDTHH-MM-SS.tar.zst`

## Configuration

### Basic Setup

The backup service is configured in `docker-compose.yml`:

```yaml
backup:
  image: offen/docker-volume-backup:2.44.0
  restart: unless-stopped
  env_file:
    - ./extra/backup.env
  volumes:
    - postgres_data:/backup/postgres:ro
    - redis_data:/backup/redis:ro
    - chromadb_data:/backup/chromadb:ro
    - app_content:/backup/app_content:ro
    - app_logs:/backup/app_logs:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./backups:/archive
```

### Backup Settings

All backup settings are configured in `extra/backup.env`. Key settings include:

- `BACKUP_CRON_EXPRESSION` - When backups run (default: 2 AM daily)
- `BACKUP_RETENTION_DAYS` - How long to keep backups (default: 7 days)
- `BACKUP_COMPRESSION` - Compression method (default: zst for Zstandard)
- `BACKUP_ARCHIVE` - Local storage directory (default: /archive)

### Container Stopping During Backup

To ensure data consistency, the following containers are stopped during backup:

- PostgreSQL database (`db`)
- Redis cache (`redis`)
- ChromaDB vector database (`chromadb`)

These containers are automatically restarted after the backup completes.

## Local Backups

Backups are stored in the `./backups` directory on the host machine. This directory is automatically
created when you start the backup service.

### Accessing Backups

```bash
# List all backups
ls ./backups

# View the latest backup (symlink)
ls -lh ./backups/backup-openu-latest.tar.gz
```

**Note**: The symlink `backup-openu-latest.tar.gz` may have a `.tar.gz` extension even though it
points to a `.tar.zst` file. This is a known behavior of the backup tool. Always use the `--zstd`
flag when extracting or listing the contents of the backup.

## Remote Storage (Optional)

The backup system supports multiple remote storage backends:

### S3-Compatible Storage (AWS, MinIO, DigitalOcean Spaces, etc.)

Uncomment and configure in `extra/backup.env`:

```env
AWS_S3_BUCKET_NAME="your-backup-bucket"
AWS_S3_PATH="openu-backups"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_ENDPOINT="s3.amazonaws.com"  # Or your S3-compatible endpoint
```

### Azure Blob Storage

```env
AZURE_STORAGE_ACCOUNT_NAME="your-account"
AZURE_STORAGE_PRIMARY_ACCOUNT_KEY="your-key"
AZURE_STORAGE_CONTAINER_NAME="backups"
```

### Dropbox

```env
DROPBOX_REMOTE_PATH="/backups"
DROPBOX_APP_KEY="your-app-key"
DROPBOX_APP_SECRET="your-app-secret"
DROPBOX_REFRESH_TOKEN="your-refresh-token"
```

## Restoring from Backup

### 1. Stop the Application

```bash
docker compose down
```

### 2. Extract the Backup

```bash
# Extract to a temporary directory (use the actual backup filename or the symlink)
mkdir temp-restore

# For zstd compressed backups (.tar.zst)
tar --zstd -xf ./backups/backup-openu-YYYY-MM-DDTHH-MM-SS.tar.zst -C temp-restore
# OR using the latest symlink
tar --zstd -xf ./backups/backup-openu-latest.tar.gz -C temp-restore

# For gzip compressed backups (.tar.gz) - if you change compression format
# tar -xzf ./backups/backup-openu-YYYY-MM-DDTHH-MM-SS.tar.gz -C temp-restore
```

### 3. Restore Specific Volumes

```bash
# Restore PostgreSQL data
docker run --rm -v openu-dev_postgres_data:/data -v ${PWD}/temp-restore/backup/postgres:/backup alpine sh -c "cd /data && cp -a /backup/* ."

# Restore Redis data
docker run --rm -v openu-dev_redis_data:/data -v ${PWD}/temp-restore/backup/redis:/backup alpine sh -c "cd /data && cp -a /backup/* ."

# Restore ChromaDB data
docker run --rm -v openu-dev_chromadb_data:/data -v ${PWD}/temp-restore/backup/chromadb:/backup alpine sh -c "cd /data && cp -a /backup/* ."

# Restore app content
docker run --rm -v openu-dev_app_content:/data -v ${PWD}/temp-restore/backup/app_content:/backup alpine sh -c "cd /data && cp -a /backup/* ."

# Restore app logs
docker run --rm -v openu-dev_app_logs:/data -v ${PWD}/temp-restore/backup/app_logs:/backup alpine sh -c "cd /data && cp -a /backup/* ."
```

### 4. Start the Application

```bash
docker compose up -d
```

### 5. Clean Up

```bash
Remove-Item -Recurse -Force temp-restore
```

## Manual Backup

To trigger a manual backup immediately:

```bash
docker compose exec backup backup
```

## Monitoring

### Check Backup Logs

```bash
# View live logs
docker compose logs -f backup

# View recent logs
docker compose logs --tail=100 backup
```

### Verify Backup Integrity

```bash
# List contents without extracting (for zstd compressed backups)
tar --zstd -tf ./backups/backup-openu-latest.tar.gz

# Or for the actual .tar.zst file
tar --zstd -tf ./backups/backup-openu-YYYY-MM-DDTHH-MM-SS.tar.zst
```

## Notifications (Optional)

Configure webhook notifications for backup success/failure by adding to `extra/backup.env`:

```env
# Slack
NOTIFICATION_URLS="slack://token@channel"

# Discord
NOTIFICATION_URLS="discord://token@channel"

# Multiple webhooks (comma-separated)
NOTIFICATION_URLS="slack://token@channel,discord://token@channel"
```

## Encryption (Optional)

### Symmetric Encryption (GPG)

```env
GPG_PASSPHRASE="your-secure-passphrase"
```

### Asymmetric Encryption (Age)

```env
AGE_PUBLIC_KEYS="age1xxxxxxxxxxxxx,age1yyyyyyyyyyyyy"
```

## Troubleshooting

### "gzip: stdin: not in gzip format" Error

If you see this error when trying to extract or list backup contents:

```bash
tar -tzf ./backups/backup-openu-latest.tar.gz
# gzip: stdin: not in gzip format
```

**Solution**: The backup is using zstd compression, not gzip. Use the `--zstd` flag:

```bash
# List contents
tar --zstd -tf ./backups/backup-openu-latest.tar.gz

# Extract backup
tar --zstd -xf ./backups/backup-openu-latest.tar.gz -C temp-restore
```

### Backup Not Running

1. Check if the backup container is running:

   ```bash
   docker compose ps backup
   ```

2. Check logs for errors:

   ```bash
   docker compose logs backup
   ```

### Out of Disk Space

Adjust retention period in `extra/backup.env`:

```env
BACKUP_RETENTION_DAYS="3"  # Keep fewer days
```

### Backup Takes Too Long

1. Increase compression parallelism:

   ```env
   GZIP_PARALLELISM="0"  # Use all CPU cores
   ```

2. Zstandard compression is already enabled (fastest option):

   ```env
   BACKUP_COMPRESSION="zst"  # Already using Zstandard
   ```

   If you need even faster backups at the cost of slightly larger files:

   ```env
   BACKUP_COMPRESSION="none"  # No compression, tar only
   ```

## Security Considerations

1. **Backup Directory Permissions**: Ensure `./backups` has appropriate permissions
2. **Encryption**: Enable encryption for sensitive data
3. **Remote Storage**: Use secure credentials and HTTPS endpoints
4. **Access Control**: Limit access to backup files and configuration

## Additional Resources

- [docker-volume-backup Documentation](https://github.com/offen/docker-volume-backup)
- [Cron Expression Reference](https://crontab.guru/)
- [GPG Encryption Guide](https://www.gnupg.org/gph/en/manual.html)
