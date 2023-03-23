export default function shortId(id: string, length = 8, glue = '…') {
  return id.length < length + 2
    ? id
    : id.slice(0, Math.floor(length / 2)) + glue + id.slice(-1 * Math.ceil(length / 2))
}
