export const createFileChunks = (file: File, size: number) => {
  const fileChunkList = [];
  let current = 0;
  while (current < file.size) {
    fileChunkList.push({
      chunkFile: file.slice(current, current + size),
    });
    current += size;
  }
  return fileChunkList;
};
