# Test slideshow upload (manual)

Use the following curl example to test the multi-file slideshow endpoint locally (replace <BAR_ID> and file paths):

curl -v -F "barId=<BAR_ID>" -F "files=@/path/to/image1.jpg" -F "files=@/path/to/image2.jpg" http://localhost:3003/api/upload-menu-slideshow

Notes:
- Ensure the dev server is running for the `staff` app (`pnpm dev` or `pnpm dev:staff`).
- The endpoint accepts up to 5 images (jpeg/png/webp) and returns JSON with `uploaded: [{url, order}]` on success.
