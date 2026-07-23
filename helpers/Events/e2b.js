import { runCodeInSandbox } from '../../machine/e2b.js';
import fs from 'fs';
import path from 'path';

export default async function on({ Exp, ev, store, cht, ai, is }) {
  let { sender, id } = cht;
  const { func } = Exp;
  const user = sender.split('@')[0];

  ev.on(
    {
      cmd: ['e2b', 'runcode', 'python', 'py'],
      listmenu: ['e2b'],
      tag: 'tools',
      args: 'Masukkan kode Python yang ingin dijalankan! Contoh: *.e2b print("Halo dari E2B!")*',
    },
    async ({ args }) => {
      const _key = keys[sender];
      await cht.edit('```Sedang menyiapkan secure E2B Sandbox & sinkronisasi VFS Anda...```', _key, true);

      try {
        const result = await runCodeInSandbox({
          code: args,
          language: 'python',
          userId: user,
        });

        if (!result.success) {
          return cht.reply(`❌ *E2B Sandbox Error:*\n\n${result.error}`);
        }

        let replyMsg = `*💻 [ Hasil Eksekusi E2B Sandbox ]*\n\n`;

        if (result.stdout) {
          replyMsg += `*Standard Output (stdout):*\n\`\`\`\n${result.stdout}\n\`\`\`\n`;
        }

        if (result.stderr) {
          replyMsg += `*⚠️ Standard Error (stderr):*\n\`\`\`\n${result.stderr}\n\`\`\`\n`;
        }

        if (result.error) {
          replyMsg += `*❌ Execution Error:*\n\`\`\`\n${JSON.stringify(result.error, null, 2)}\n\`\`\`\n`;
        }

        if (!result.stdout && !result.stderr && !result.error) {
          replyMsg += `_(Kode berhasil dieksekusi tanpa console output)_`;
        }

        // Send text response
        await cht.reply(replyMsg);

        // If any files/plots were generated, send them
        if (result.files && result.files.length > 0) {
          for (const file of result.files) {
            await cht.reply(`📈 *Plot Terdeteksi:* Mengirimkan hasil grafik *${file.filename}*...`);
            const buffer = Buffer.from(file.base64, 'base64');
            await Exp.sendMessage(
              id,
              {
                image: buffer,
                caption: `📊 Hasil Plot: *${file.filename}*`,
              },
              { quoted: cht }
            );
          }
        }
      } catch (err) {
        return cht.reply(`❌ Terjadi kesalahan fatal: ${err.message}`);
      }
    }
  );
}
