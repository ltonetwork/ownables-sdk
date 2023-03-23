export default function asDownload(content: Blob, filename: string) {
  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(content);
  downloadLink.download = filename;

  document.body.appendChild(downloadLink);
  downloadLink.click();

  // cleanup
  setTimeout(() => {
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);
  }, 100);
}
