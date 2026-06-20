export const MAX_USER_UPLOAD_FILES = 5;
export const MAX_USER_UPLOAD_FILE_BYTES = 1024 * 1024;
export const MAX_USER_UPLOAD_TOTAL_BYTES = 3 * 1024 * 1024;

const USER_UPLOADS_ROOT = "/workspace/user_uploads";
export const USER_UPLOADS_ORIGINALS_ROOT = `${USER_UPLOADS_ROOT}/originals`;
export const USER_UPLOADS_COPIES_ROOT = `${USER_UPLOADS_ROOT}/copies`;
export const USER_UPLOADS_MANIFEST_PATH = `${USER_UPLOADS_ROOT}/manifest.json`;
