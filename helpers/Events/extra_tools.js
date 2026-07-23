import { performWebSearch, safeEval } from './skills.js';

export default async function on({ Exp, ev, store, cht, ai, is }) {
  let { sender, id } = cht;

  ev.on(
    {
      cmd: ['websearch', 'search', 'gsearch'],
      listmenu: ['websearch'],
      tag: 'search',
      args: 'Masukkan kata kunci pencarian! Contoh: *.websearch harga saham Apple hari ini*',
    },
    async ({ args }) => {
      const _key = keys[sender];
      await cht.edit('```Sedang mencari informasi di web...```', _key, true);

      try {
        const results = await performWebSearch(args);
        if (results.length === 0) {
          return cht.reply('❌ Tidak ditemukan hasil pencarian untuk kata kunci tersebut.');
        }

        let txt = `*🔍 [ Hasil Pencarian Web: ${args} ]*\n\n`;
        results.forEach((r, idx) => {
          txt += `*${idx + 1}. ${r.title}*\n`;
          txt += `_Snippet:_ ${r.snippet}\n`;
          txt += `_Link:_ ${r.link}\n\n`;
        });

        return cht.reply(txt);
      } catch (err) {
        return cht.reply(`❌ Terjadi kesalahan saat melakukan pencarian: ${err.message}`);
      }
    }
  );

  ev.on(
    {
      cmd: ['calc', 'kalkulator', 'hitung'],
      listmenu: ['calc'],
      tag: 'tools',
      args: 'Masukkan ekspresi matematika! Contoh: *.calc 2 + 5 * (10 / 2)*',
    },
    async ({ args }) => {
      try {
        const result = safeEval(args);
        return cht.reply(`*🧮 [ Hasil Perhitungan ]*\n\n*Soal:* ${args}\n*Hasil:* ${result}`);
      } catch (err) {
        return cht.reply(`❌ Gagal menghitung ekspresi: ${err.message}`);
      }
    }
  );
}
