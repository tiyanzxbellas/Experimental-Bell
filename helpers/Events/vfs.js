import fs from 'fs';
import path from 'path';

export default async function on({ Exp, ev, store, cht, ai, is }) {
  let { sender, id } = cht;
  const { func } = Exp;
  const user = sender.split('@')[0];
  const userVfsDir = path.resolve('toolkit/db/vfs', user);

  // Helper to ensure user VFS dir exists
  const ensureVfsDir = () => {
    if (!fs.existsSync(userVfsDir)) {
      fs.mkdirSync(userVfsDir, { recursive: true });
    }
  };

  ev.on(
    {
      cmd: ['vfs'],
      listmenu: ['vfs'],
      tag: 'tools',
      desc: 'Virtual File System per user',
    },
    async () => {
      ensureVfsDir();
      const q = cht.q ? cht.q.trim() : '';
      const parts = q.split(/\s+/);
      const action = parts[0]?.toLowerCase();

      const helpText = `*📁 [ Virtual File System (VFS) ]*

Gunakan VFS untuk mengelola file virtual Anda yang dapat digunakan oleh AI Sandbox & Skill System!

*Perintah yang tersedia:*
1. *.vfs ls* atau *.vfs list*
   _Menampilkan semua file di VFS Anda._
2. *.vfs read <nama_file>*
   _Membaca isi file teks di VFS Anda._
3. *.vfs write <nama_file> <konten>*
   _Membuat atau menimpa file teks di VFS Anda._
4. *.vfs rm <nama_file>* atau *.vfs delete <nama_file>*
   _Menghapus file dari VFS Anda._
5. *.vfs upload <nama_file>*
   _Reply media (gambar, dokumen, audio, dll) lalu ketik perintah ini untuk mengunggahnya ke VFS._`;

      if (!action) {
        return cht.reply(helpText);
      }

      if (action === 'ls' || action === 'list') {
        const files = fs.readdirSync(userVfsDir);
        if (files.length === 0) {
          return cht.reply('📂 *VFS Anda kosong.* Belum ada file yang disimpan.');
        }

        let txt = `*📁 [ Daftar File VFS Anda ]*\n\n`;
        files.forEach((file, index) => {
          const filePath = path.join(userVfsDir, file);
          const stat = fs.statSync(filePath);
          const size = stat.size.toFormat ? stat.size.toFormat() : `${(stat.size / 1024).toFixed(2)} KB`;
          txt += `${index + 1}. *${file}* (${size})\n`;
        });
        return cht.reply(txt);
      }

      if (action === 'read') {
        const filename = parts[1];
        if (!filename) return cht.reply('⚠️ Harap masukkan nama file yang ingin dibaca! Contoh: *.vfs read catatan.txt*');
        const safeName = path.basename(filename);
        const filePath = path.join(userVfsDir, safeName);

        if (!fs.existsSync(filePath)) {
          return cht.reply(`❌ File *${safeName}* tidak ditemukan di VFS Anda.`);
        }

        const stat = fs.statSync(filePath);
        // If file is binary or too large, suggest downloading/checking type
        const ext = path.extname(safeName).toLowerCase();
        const textExtensions = ['.txt', '.js', '.json', '.py', '.html', '.css', '.md', '.xml', '.csv', '.yaml', '.yml'];
        if (!textExtensions.includes(ext) && stat.size > 50 * 1024) {
          return cht.reply(`⚠️ File *${safeName}* terdeteksi sebagai file non-teks atau berukuran besar (${(stat.size / 1024).toFixed(2)} KB). Membaca file ini langsung mungkin merusak format tampilan.`);
        }

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          return cht.reply(`*📄 [ File: ${safeName} ]*\n\n\`\`\`\n${content}\n\`\`\``);
        } catch (err) {
          return cht.reply(`❌ Gagal membaca file: ${err.message}`);
        }
      }

      if (action === 'write') {
        const filename = parts[1];
        if (!filename) return cht.reply('⚠️ Harap masukkan nama file! Contoh: *.vfs write halo.txt Halo Dunia!*');
        const safeName = path.basename(filename);
        const filePath = path.join(userVfsDir, safeName);
        const content = q.slice(action.length + filename.length + 2).trim();

        if (!content) return cht.reply('⚠️ Harap masukkan konten yang ingin ditulis!');

        try {
          fs.writeFileSync(filePath, content, 'utf8');
          return cht.reply(`✅ Berhasil menulis ke file *${safeName}* di VFS Anda.`);
        } catch (err) {
          return cht.reply(`❌ Gagal menulis file: ${err.message}`);
        }
      }

      if (action === 'rm' || action === 'delete') {
        const filename = parts[1];
        if (!filename) return cht.reply('⚠️ Harap masukkan nama file! Contoh: *.vfs rm halo.txt*');
        const safeName = path.basename(filename);
        const filePath = path.join(userVfsDir, safeName);

        if (!fs.existsSync(filePath)) {
          return cht.reply(`❌ File *${safeName}* tidak ditemukan di VFS Anda.`);
        }

        try {
          fs.unlinkSync(filePath);
          return cht.reply(`✅ Berhasil menghapus file *${safeName}* dari VFS Anda.`);
        } catch (err) {
          return cht.reply(`❌ Gagal menghapus file: ${err.message}`);
        }
      }

      if (action === 'upload') {
        const quoted = cht.quoted;
        if (!quoted) {
          return cht.reply('⚠️ Harap balas (reply) media (gambar, audio, dokumen, dll) yang ingin diunggah ke VFS Anda!');
        }

        let filename = parts[1];
        let ext = '';

        // Try to detect extension/filename from quoted message
        const quotedType = quoted.mtype || '';
        const mediaMessage = quoted[quotedType] || {};

        if (!filename) {
          filename = mediaMessage.fileName || mediaMessage.filename || '';
          if (!filename) {
            const types = {
              imageMessage: 'image.png',
              videoMessage: 'video.mp4',
              audioMessage: 'audio.mp3',
              stickerMessage: 'sticker.webp',
              documentMessage: 'document.bin',
            };
            filename = types[quotedType] || 'uploaded_file.bin';
          }
        }

        const safeName = path.basename(filename);
        const filePath = path.join(userVfsDir, safeName);

        try {
          await cht.reply('```Mengunduh media dari WhatsApp...```');
          const buffer = await quoted.download();
          if (!buffer) return cht.reply('❌ Gagal mengunduh media dari pesan.');

          fs.writeFileSync(filePath, buffer);
          const size = (buffer.length / 1024).toFixed(2);
          return cht.reply(`✅ Berhasil mengunggah media ke VFS sebagai *${safeName}* (${size} KB).`);
        } catch (err) {
          return cht.reply(`❌ Gagal mengunggah file: ${err.message}`);
        }
      }

      return cht.reply(helpText);
    }
  );
}
