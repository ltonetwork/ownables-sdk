export default function shortId(id: string) {
  return id.length < 10 ? id : id.slice(0, 4) + "…" + id.slice(-4)
}
