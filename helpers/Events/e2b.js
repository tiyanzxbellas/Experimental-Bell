import { runCodeInSandbox } from '../../machine/e2b.js';
import { runWorkflowAgent, loadAllSkills } from './skills.js';
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
    },
    async () => {
      const q = cht.q ? cht.q.trim() : '';

      // If no query or arguments are provided, return an interactive help menu
      if (!q) {
        let helpText = `*💻 [ SISTEM E2B SANDBOX & AGENT BELLA ]*\n\n`;
        helpText += `Sistem ini menyatukan keandalan secure E2B Python Sandbox dengan kecerdasan workflow otonom Bella.\n\n`;
        helpText += `*1. Eksekusi Kode Langsung (E2B Tools)*\n`;
        helpText += `• *.e2b [kode Python]* atau *.py [kode Python]*\n`;
        helpText += `  > Menjalankan kode Python secara langsung di secure sandbox, otomatis sinkronisasi dengan Virtual File System (VFS) Anda.\n\n`;
        helpText += `*2. Asisten Otonom (Natural Language / AI Agent)*\n`;
        helpText += `• *.e2b [permintaan bahasa alami]*\n`;
        helpText += `  > Menggunakan Bella Agent untuk menyelesaikan tugas rumit selangkah demi selangkah secara otomatis menggunakan tools (VFS, python, search, kalkulator).\n`;
        helpText += `  > _Contoh: *.e2b buatkan plot tren penjualan dari data.csv di VFS dan simpan hasilnya*_ atau _*.e2b tambahkan skill cari_berita_*\n\n`;
        helpText += `*3. Sub-Command / Shortcut System*\n`;
        helpText += `• *.e2b write [nama_skill] [markdown_skill]* - Membuat/memperbarui skill workflow\n`;
        helpText += `• *.e2b run [nama_skill] [parameter]* - Menjalankan workflow skill yang ada\n`;
        helpText += `• *.e2b del [nama_skill]* - Menghapus skill workflow\n`;
        helpText += `• *.e2b list* atau *.e2b skills* - Melihat daftar skill workflow yang terdaftar\n`;
        helpText += `• *.e2b py [kode Python]* - Memaksa eksekusi kode Python langsung\n\n`;
        helpText += `_Gunakan kecerdasan asisten Bella untuk mempermudah pekerjaan pemrograman dan workflow Anda!_`;
        return cht.reply(helpText);
      }

      // Check subcommands
      const parts = q.split(/\s+/);
      const subCommand = parts[0].toLowerCase();
      const subArgs = q.slice(parts[0].length).trim();

      // Subcommand: run or workflow
      if (subCommand === 'run' || subCommand === 'workflow') {
        if (!subArgs) return cht.reply('❌ Harap tentukan nama skill dan parameternya! Contoh: *.e2b run myplot hitung rata-rata*');
        const skillParts = subArgs.split(/\s+/);
        const skillName = skillParts[0].toLowerCase();
        const inputParams = subArgs.slice(skillParts[0].length).trim();

        loadAllSkills();
        const skill = Data.skills[skillName];
        if (!skill) {
          return cht.reply(`❌ Skill *${skillName}* tidak ditemukan! Ketik *.e2b list* untuk melihat daftar skill.`);
        }
        return await runWorkflowAgent({ Exp, cht, skillName, userInput: inputParams, ev });
      }

      // Subcommand: write or add
      if (subCommand === 'write' || subCommand === 'add') {
        if (!subArgs) return cht.reply('❌ Harap masukkan nama skill dan isi markdown skill! Contoh: *.e2b write myplot # Skill: myplot...*');
        const skillParts = subArgs.split(/\s+/);
        const skillName = skillParts[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!skillName) return cht.reply('❌ Nama skill tidak valid!');

        let content = '';
        if (cht.quoted) {
          content = cht.quoted.text || cht.quoted.caption || '';
        } else {
          content = subArgs.slice(skillParts[0].length).trim();
        }

        if (!content) return cht.reply('❌ Harap sertakan markdown skill atau reply pesan markdown!');

        const skillsDir = path.resolve('toolkit/db/skills');
        if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });
        const filePath = path.join(skillsDir, `${skillName}.md`);
        try {
          fs.writeFileSync(filePath, content, 'utf8');
          loadAllSkills();
          return cht.reply(`✅ Berhasil menambahkan skill *${skillName}*! Skill ini sekarang aktif dan dapat langsung digunakan dengan *.e2b run ${skillName}*.`);
        } catch (err) {
          return cht.reply(`❌ Gagal menambahkan skill: ${err.message}`);
        }
      }

      // Subcommand: del or rm or delete
      if (subCommand === 'del' || subCommand === 'rm' || subCommand === 'delete') {
        if (!subArgs) return cht.reply('❌ Harap tentukan nama skill yang ingin dihapus! Contoh: *.e2b del myplot*');
        const skillName = subArgs.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const filePath = path.resolve('toolkit/db/skills', `${skillName}.md`);
        if (!fs.existsSync(filePath)) {
          return cht.reply(`❌ Skill *${skillName}* tidak ditemukan.`);
        }
        try {
          fs.unlinkSync(filePath);
          loadAllSkills();
          return cht.reply(`✅ Berhasil menghapus skill *${skillName}*.`);
        } catch (err) {
          return cht.reply(`❌ Gagal menghapus skill: ${err.message}`);
        }
      }

      // Subcommand: list or skills
      if (subCommand === 'list' || subCommand === 'skills') {
        loadAllSkills();
        const keys = Object.keys(Data.skills);
        if (keys.length === 0) {
          return cht.reply('📄 *Belum ada skill yang terdaftar.* Gunakan *.e2b write <nama>* untuk membuat skill baru.');
        }

        let txt = `*🛠️ [ Daftar Skill System Workflows (Skills MD) ]*\n\n`;
        keys.forEach((key, idx) => {
          const skill = Data.skills[key];
          txt += `${idx + 1}. *${key}* - _${skill.name}_\n`;
          txt += `   > ${skill.description.split('\n')[0]}\n\n`;
        });
        txt += `_Ketik *.e2b run <nama_skill> [input/parameter]* untuk menjalankan workflow_`;
        return cht.reply(txt);
      }

      // Subcommand: py or python or runcode
      let forcePython = false;
      let pyCode = q;
      if (subCommand === 'py' || subCommand === 'python' || subCommand === 'runcode') {
        forcePython = true;
        pyCode = subArgs;
      }

      // Determine if we should treat it as raw Python or Natural Language task
      // Criteria: forcePython is true, OR the input looks like raw Python code (starts with imports, def, class, has print/indentation/symbols), OR the command called is py/python/runcode
      const isPythonCmd = ['py', 'python', 'runcode'].includes(cht.cmd);
      const isRawPython = forcePython || isPythonCmd || /^\s*(import\s+|from\s+|def\s+|class\s+|print\s*\(|#|assert\s+)/m.test(q) || (q.includes('=') && q.includes('(') && (q.includes('print') || q.includes('import') || q.includes('\n')));

      if (isRawPython) {
        // Execute python code directly in the sandbox
        const _key = keys[sender];
        await cht.edit('```Sedang menyiapkan secure E2B Sandbox & sinkronisasi VFS Anda...```', _key, true);

        try {
          const result = await runCodeInSandbox({
            code: pyCode,
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
      } else {
        // Treat as Natural Language request, invoke runWorkflowAgent to solve it autonomously
        await runWorkflowAgent({ Exp, cht, userInput: q, ev });
      }
    }
  );
}
