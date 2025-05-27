## 📦 A Guide for Devs and Builders: Working with LTO Ownables

As the **LTO Ownables** ecosystem grows, the need for robust tooling and clear developer guidelines becomes essential. This guide will walk you through how to structure and send Ownables using the **LTO SDK and relay infrastructure**.

If you're building Ownables or integrating them into your app, this guide is for you.

---

### 🔧 Structuring Your Ownable Message

Each Ownable is packaged and sent between wallets using the **Relay Server**, which handles wallet-to-wallet communication on the LTO Network.

To ensure your Ownable can be **previewed before download**, you should include a **`thumbnail.webp`** file inside the Ownable zip package.

#### 📸 Thumbnail Guidelines:

- File name must be: `thumbnail.webp`
- Maximum file size: **256 KB**
- Format: `.webp` (required)
- This preview is used by clients to render a quick snapshot of the Ownable before the user chooses to download it.

> **Note**: In the official SDK, thumbnail resizing is handled automatically when you initiate a transfer. However, in custom apps, you may need to handle resizing manually depending on your use case.

---

### 🚀 Sending Ownables

Ownables can be sent directly between wallets using the Relay Server, which supports:

- End-to-end encrypted delivery
- File previews (when `thumbnail.webp` is present)
- Ownable metadata sync

Make sure your message includes the structured Ownable zip with any required metadata or signature files as per the Ownables spec.

---

### ✅ Quick Checklist for App Integrators:

- [ ] Package your Ownable as a `.zip` file
- [ ] Include `thumbnail.webp` (≤ 256 KB)
- [ ] Use SDK for automatic resizing, or implement your own
- [ ] Send the package using the relay protocol
- [ ] Handle preview rendering on the recipient side

---

### 📚 More Resources

- [LTO Network Docs](https://docs.ltonetwork.com/)
- [Ownables SDK on GitHub](https://github.com/ltonetwork/ownables-sdk)
- [Examples and Demos](https://demo.ownables.info)
