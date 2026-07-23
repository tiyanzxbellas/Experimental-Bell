import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import axios from 'axios';
import { runCodeInSandbox } from '../../machine/e2b.js';

// Hot-loading skills map
Data.skills = Data.skills || {};

const skillsDir = path.resolve('toolkit/db/skills');
if (!fs.existsSync(skillsDir)) {
  fs.mkdirSync(skillsDir, { recursive: true });
}

// sleep utility function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to perform web search using DuckDuckGo
export async function performWebSearch(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    const results = [];
    $('.result__body').slice(0, 5).each((i, el) => {
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const link = $(el).find('.result__url').attr('href') || '';
      let cleanLink = link;
      if (link.includes('uddg=')) {
        try {
          const parts = link.split('uddg=');
          if (parts[1]) {
            cleanLink = decodeURIComponent(parts[1].split('&')[0]);
          }
        } catch (e) {}
      }
      results.push({ title, snippet, link: cleanLink });
    });
    return results;
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}

// Function to safely evaluate mathematical expressions
export function safeEval(expr) {
  const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
  try {
    const val = Function(`return (${sanitized})`)();
    return typeof val === 'number' ? val : 'Error: Invalid expression';
  } catch (err) {
    return 'Error: Invalid expression';
  }
}

// Function to load/reload all skills from disk
export function loadAllSkills() {
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  const files = fs.readdirSync(skillsDir).filter(file => file.endsWith('.md'));
  Data.skills = {};
  for (const file of files) {
    const filePath = path.join(skillsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const skillName = path.basename(file, '.md').toLowerCase();

    // Parse name, description and instructions
    const nameMatch = content.match(/^#\s*Skill:\s*(.*)$/m) || content.match(/^#\s*(.*)$/m);
    const name = nameMatch ? nameMatch[1].trim() : path.basename(file, '.md');

    const descMatch = content.match(/##\s*Description\n([\s\S]*?)(?=\n##|$)/i);
    const description = descMatch ? descMatch[1].trim() : 'No description provided.';

    const instMatch = content.match(/##\s*Instructions\n([\s\S]*?)(?=\n##|$)/i);
    const instructions = instMatch ? instMatch[1].trim() : 'No instructions provided.';

    Data.skills[skillName] = {
      filename: file,
      name,
      description,
      instructions,
      raw: content
    };
  }
  console.log(`[Skills] Loaded ${Object.keys(Data.skills).length} skills from disk.`);
}

// Load skills immediately
loadAllSkills();

export default async function on({ Exp, ev, store, cht, ai, is }) {
  let { sender, id } = cht;
  const { func } = Exp;
  const user = sender.split('@')[0];
  const userVfsDir = path.resolve('toolkit/db/vfs', user);

  // Load reasoner dynamically
  const { ai: runAiReasoner } = await `${fol[2]}reasoner.js`.r();

  ev.on(
    {
      cmd: ['addskill', 'writeskill'],
      listmenu: ['addskill'],
      tag: 'tools',
      args: 'Masukkan nama skill dan isi markdown skill! Contoh: *.addskill myplot* atau reply pesan markdown dengan *.addskill myplot*',
    },
    async () => {
      const q = cht.q ? cht.q.trim() : '';
      const parts = q.split(/\s+/);
      const skillName = parts[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');

      if (!skillName) return cht.reply('❌ Nama skill tidak valid!');

      let content = '';
      if (cht.quoted) {
        // If quoted a message
        content = cht.quoted.text || cht.quoted.caption || '';
      } else {
        content = q.slice(parts[0].length).trim();
      }

      if (!content) {
        return cht.reply('❌ Harap masukkan isi markdown skill atau reply pesan markdown!');
      }

      const filePath = path.join(skillsDir, `${skillName}.md`);
      try {
        fs.writeFileSync(filePath, content, 'utf8');
        // Hot-load immediately!
        loadAllSkills();
        return cht.reply(`✅ Berhasil menambahkan skill *${skillName}*! Skill ini sekarang aktif dan dapat langsung digunakan dengan *.runskill ${skillName}*.`);
      } catch (err) {
        return cht.reply(`❌ Gagal menambahkan skill: ${err.message}`);
      }
    }
  );

  ev.on(
    {
      cmd: ['listskills', 'skills'],
      listmenu: ['listskills'],
      tag: 'tools',
    },
    async () => {
      loadAllSkills(); // Ensure we are synchronized
      const keys = Object.keys(Data.skills);
      if (keys.length === 0) {
        return cht.reply('📄 *Belum ada skill yang terdaftar.* Gunakan *.addskill <nama>* untuk membuat skill baru.');
      }

      let txt = `*🛠️ [ Daftar Skill System Workflows (Skills MD) ]*\n\n`;
      keys.forEach((key, index) => {
        const skill = Data.skills[key];
        txt += `${index + 1}. *${key}* - _${skill.name}_\n`;
        txt += `   > ${skill.description.split('\n')[0]}\n\n`;
      });
      txt += `_Ketik *.runskill <nama_skill> [input/parameter]* untuk menjalankan workflow_`;
      return cht.reply(txt);
    }
  );

  ev.on(
    {
      cmd: ['delskill', 'rmskill'],
      listmenu: ['delskill'],
      tag: 'tools',
      args: 'Masukkan nama skill yang ingin dihapus! Contoh: *.delskill myplot*',
    },
    async () => {
      const skillName = cht.q.trim().toLowerCase();
      const filePath = path.join(skillsDir, `${skillName}.md`);

      if (!fs.existsSync(filePath)) {
        return cht.reply(`❌ Skill *${skillName}* tidak ditemukan.`);
      }

      try {
        fs.unlinkSync(filePath);
        loadAllSkills(); // Hot-reload immediately
        return cht.reply(`✅ Berhasil menghapus skill *${skillName}*.`);
      } catch (err) {
        return cht.reply(`❌ Gagal menghapus skill: ${err.message}`);
      }
    }
  );

  ev.on(
    {
      cmd: ['runskill', 'workflow'],
      listmenu: ['runskill'],
      tag: 'tools',
      args: 'Masukkan nama skill dan parameter input! Contoh: *.runskill myplot hitung rata-rata dan buat chart*',
    },
    async () => {
      loadAllSkills(); // Ensure synced
      const q = cht.q ? cht.q.trim() : '';
      const parts = q.split(/\s+/);
      const skillName = parts[0].toLowerCase();
      const userInput = q.slice(parts[0].length).trim();

      const skill = Data.skills[skillName];
      if (!skill) {
        return cht.reply(`❌ Skill *${skillName}* tidak ditemukan! Ketik *.listskills* untuk melihat daftar skill.`);
      }

      const _key = keys[sender];
      await cht.edit(`🤖 *[ Workflow Engine ]*\n\nMemulai eksekusi skill: *${skill.name}*...\n\n_Membaca instruksi & menyiapkan environment..._`, _key, true);

      // Create user VFS directory if it doesn't exist
      if (!fs.existsSync(userVfsDir)) {
        fs.mkdirSync(userVfsDir, { recursive: true });
      }

      // Initialize history for the agentic loop
      let stepHistory = `--- WORKFLOW INSTRUCTIONS ---\n${skill.instructions}\n\n--- USER INPUT ---\n${userInput}\n\n`;
      let currentIteration = 1;
      const maxIterations = 8;
      let workflowFinished = false;

      // Define available tools
      const tools = [
        {
          description: "Melihat daftar file di Virtual File System (VFS) user.",
          output: { cmd: "vfs_ls" }
        },
        {
          description: "Membaca isi file di VFS user.",
          output: { cmd: "vfs_read", cfg: { filename: "nama_file.txt" } }
        },
        {
          description: "Menulis atau memperbarui file di VFS user.",
          output: { cmd: "vfs_write", cfg: { filename: "nama_file.txt", content: "isi konten file" } }
        },
        {
          description: "Menjalankan kode Python di secure E2B Sandbox. Secara otomatis mengunggah seluruh isi VFS Anda ke sandbox sebelum eksekusi, serta mengunduh seluruh file baru/grafik yang dibuat kembali ke VFS Anda.",
          output: { cmd: "e2b_run", cfg: { code: "import pandas as pd\n..." } }
        },
        {
          description: "Melakukan pencarian informasi real-time di web.",
          output: { cmd: "web_search", cfg: { query: "query pencarian" } }
        },
        {
          description: "Kalkulator untuk menghitung ekspresi matematika secara aman.",
          output: { cmd: "calc", cfg: { expression: "2 * (5 + 3)" } }
        },
        {
          description: "Menyelesaikan workflow dan memberikan hasil akhir/rangkuman lengkap kepada user.",
          output: { cmd: "workflow_complete", msg: "Rangkuman lengkap dan hasil akhir workflow Anda." }
        }
      ];

      const systemProfile = `Anda adalah asisten AI otonom yang sangat terampil bernama Bella.
Tugas Anda adalah memandu dan menyelesaikan workflow instruksi skill berikut menggunakan tools yang tersedia.
Ikuti instruksi langkah-demi-langkah dengan sangat teliti.

Anda dapat menggunakan tools seperti VFS, E2B Sandbox (untuk menjalankan Python), Web Search, dan Kalkulator.
Gunakan tools tersebut secara berurutan dan otonom. Jangan menjelaskan tool call kepada user, cukup panggil tool-nya.
Setelah selesai melaksanakan seluruh instruksi atau mencapai tujuan, panggil tool 'workflow_complete' dengan rangkuman hasil.

Informasi User ID Anda: ${user}
Lakukan langkah demi langkah.`;

      while (currentIteration <= maxIterations && !workflowFinished) {
        await cht.edit(`🤖 *[ Workflow: ${skill.name} ]*\n\n[Langkah ${currentIteration}/${maxIterations}] AI sedang berpikir dan menganalisis langkah selanjutnya...`, _key, true);

        // Fetch user VFS file list to give context to the AI
        const vfsFiles = fs.existsSync(userVfsDir) ? fs.readdirSync(userVfsDir) : [];
        const vfsContext = vfsFiles.length > 0 ? `File saat ini di VFS: ${vfsFiles.join(', ')}` : 'VFS saat ini kosong.';

        const promptText = `Status Iterasi Saat Ini: ${currentIteration}
${vfsContext}

Riwayat Langkah Sebelumnya & Hasil Eksekusi:
${stepHistory}

Silakan analisis instruksi dan putuskan tindakan berikutnya. Panggil tool yang sesuai. Jika sudah selesai, panggil 'workflow_complete'.`;

        try {
          const aiResponse = await runAiReasoner({
            text: promptText,
            id: sender,
            fullainame: botfullname,
            nickainame: botnickname,
            senderName: cht.pushName,
            ownerName: ownername,
            date: func.newDate(),
            role: 'Asisten AI Alur Kerja',
            msgtype: 'text',
            custom_profile: systemProfile,
            commands: tools
          });

          const config = aiResponse?.data || {};
          console.log(`[Workflow Agent Step ${currentIteration}]`, config);

          if (!config.cmd) {
            // Default text output from AI, record it and ask again if not finished
            const msg = config.msg || aiResponse?.response || 'Memikirkan langkah berikutnya...';
            stepHistory += `\nThought: ${msg}\n`;
            currentIteration++;
            continue;
          }

          // Handle 'vfs_ls'
          if (config.cmd === 'vfs_ls') {
            const files = fs.existsSync(userVfsDir) ? fs.readdirSync(userVfsDir) : [];
            const result = files.length > 0 ? `Daftar file: ${files.join(', ')}` : 'VFS kosong.';
            stepHistory += `\nAction: vfs_ls\nResult: ${result}\n`;
            await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`vfs_ls\`\nResult: ${result}`, _key, true);
          }
          // Handle 'vfs_read'
          else if (config.cmd === 'vfs_read') {
            const filename = config.cfg?.filename;
            if (!filename) {
              stepHistory += `\nAction: vfs_read\nResult: Gagal - filename tidak disediakan.\n`;
            } else {
              const safeName = path.basename(filename);
              const filePath = path.join(userVfsDir, safeName);
              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                stepHistory += `\nAction: vfs_read(${safeName})\nResult: \`\`\`\n${content}\n\`\`\`\n`;
                await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`vfs_read\` untuk file *${safeName}*`, _key, true);
              } else {
                stepHistory += `\nAction: vfs_read(${safeName})\nResult: Gagal - file tidak ditemukan.\n`;
              }
            }
          }
          // Handle 'vfs_write'
          else if (config.cmd === 'vfs_write') {
            const filename = config.cfg?.filename;
            const content = config.cfg?.content;
            if (!filename || !content) {
              stepHistory += `\nAction: vfs_write\nResult: Gagal - filename atau content tidak disediakan.\n`;
            } else {
              const safeName = path.basename(filename);
              const filePath = path.join(userVfsDir, safeName);
              fs.writeFileSync(filePath, content, 'utf8');
              stepHistory += `\nAction: vfs_write(${safeName})\nResult: Sukses menulis file.\n`;
              await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`vfs_write\` menulis ke file *${safeName}*`, _key, true);
            }
          }
          // Handle 'e2b_run'
          else if (config.cmd === 'e2b_run') {
            const code = config.cfg?.code;
            if (!code) {
              stepHistory += `\nAction: e2b_run\nResult: Gagal - code tidak disediakan.\n`;
            } else {
              await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`e2b_run\` - Menjalankan kode Python di E2B Sandbox...`, _key, true);
              const runResult = await runCodeInSandbox({ code, language: 'python', userId: user });

              let runOutput = '';
              if (runResult.success) {
                runOutput = `stdout:\n${runResult.stdout}\nstderr:\n${runResult.stderr}`;
                if (runResult.files && runResult.files.length > 0) {
                  runOutput += `\nFile baru dihasilkan: ${runResult.files.map(f => f.filename).join(', ')}`;
                  // Instantly send generated plots/images to the user!
                  for (const f of runResult.files) {
                    await Exp.sendMessage(
                      id,
                      { image: Buffer.from(f.base64, 'base64'), caption: `📈 Plot Alur Kerja: *${f.filename}*` },
                      { quoted: cht }
                    );
                  }
                }
              } else {
                runOutput = `Error: ${runResult.error}`;
              }

              stepHistory += `\nAction: e2b_run\nCode:\n\`\`\`python\n${code}\n\`\`\`\nResult: ${runOutput}\n`;
              await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`e2b_run\` Selesai.\nOutput: ${runResult.stdout || runResult.error || 'Sukses'}`, _key, true);
            }
          }
          // Handle 'web_search'
          else if (config.cmd === 'web_search') {
            const query = config.cfg?.query;
            if (!query) {
              stepHistory += `\nAction: web_search\nResult: Gagal - query tidak disediakan.\n`;
            } else {
              await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`web_search\` - Melakukan pencarian web untuk: *${query}*...`, _key, true);
              const searchResults = await performWebSearch(query);
              const formattedResults = searchResults.map((r, i) => `[${i+1}] ${r.title}\nSnippet: ${r.snippet}\nLink: ${r.link}`).join('\n\n');
              stepHistory += `\nAction: web_search(${query})\nResult:\n${formattedResults || 'Tidak ada hasil.'}\n`;
              await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`web_search\` selesai dengan ${searchResults.length} hasil.`, _key, true);
            }
          }
          // Handle 'calc'
          else if (config.cmd === 'calc') {
            const expression = config.cfg?.expression;
            if (!expression) {
              stepHistory += `\nAction: calc\nResult: Gagal - ekspresi tidak disediakan.\n`;
            } else {
              const res = safeEval(expression);
              stepHistory += `\nAction: calc(${expression})\nResult: ${res}\n`;
              await cht.edit(`🤖 *[ Workflow ]*\nTool Call: \`calc\` - Menghitung: ${expression} = ${res}`, _key, true);
            }
          }
          // Handle 'workflow_complete'
          else if (config.cmd === 'workflow_complete') {
            workflowFinished = true;
            const finalMsg = config.msg || 'Alur kerja selesai.';
            await cht.reply(`✅ *[ WORKFLOW SELESAI: ${skill.name} ]*\n\n${finalMsg}`);
            break;
          }
          // Handle other/fallback commands if any
          else {
            stepHistory += `\nAction: Unknown Command (${config.cmd})\n`;
          }

        } catch (err) {
          console.error('[Workflow Loop Error]', err);
          stepHistory += `\nError pada langkah ${currentIteration}: ${err.message}\n`;
        }

        currentIteration++;
        await sleep(2000);
      }

      if (!workflowFinished) {
        await cht.reply(`⚠️ *[ Alur Kerja Dihentikan ]*\n\nBatas maksimum langkah (${maxIterations}) telah tercapai sebelum workflow selesai secara otonom.`);
      }
    }
  );
}
