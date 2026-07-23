import { Sandbox } from '@e2b/code-interpreter';
import fs from 'fs';
import path from 'path';

/**
 * Runs code inside an E2B Sandbox.
 * @param {Object} params
 * @param {string} params.code - The Python or JS code to run.
 * @param {string} params.language - 'python' or 'javascript' (default: 'python')
 * @param {string} params.userId - Sanitized user ID to fetch files from VFS
 * @returns {Promise<Object>} The result of execution.
 */
export async function runCodeInSandbox({ code, language = 'python', userId }) {
  const globalApiKey = typeof api !== 'undefined' ? (api?.e2b_key || api?.xterm?.e2b_key || '') : '';
  const apiKey = process.env.E2B_API_KEY || globalApiKey;

  if (!apiKey) {
    return {
      success: false,
      error: 'API Key E2B tidak ditemukan! Harap konfigurasikan E2B_API_KEY di environment variable atau .env Anda.',
      stdout: '',
      stderr: '',
      files: [],
    };
  }

  const userVfsDir = path.resolve('toolkit/db/vfs', userId);
  let sandbox;
  const downloadedFiles = [];

  try {
    // Create E2B sandbox
    sandbox = await Sandbox.create({ apiKey });

    // Upload files from user's VFS to the sandbox workspace if VFS exists
    if (fs.existsSync(userVfsDir)) {
      const files = fs.readdirSync(userVfsDir);
      for (const file of files) {
        const filePath = path.join(userVfsDir, file);
        if (fs.statSync(filePath).isFile()) {
          try {
            const buffer = fs.readFileSync(filePath);
            await sandbox.files.write(file, buffer);
            console.log(`[E2B] Uploaded VFS file to sandbox: ${file}`);
          } catch (uploadErr) {
            console.error(`[E2B] Failed to upload ${file} to sandbox:`, uploadErr);
          }
        }
      }
    }

    // Run the code
    let execution;
    if (language === 'python') {
      execution = await sandbox.runCode(code);
    } else {
      // Run as JS / other command if needed
      execution = await sandbox.commands.run(code);
    }

    const stdout = execution.stdout || '';
    const stderr = execution.stderr || '';
    const error = execution.error || null;

    // Check execution results for images/plots (e.g. matplotlib base64 results)
    const results = execution.results || [];
    let imageCounter = 1;

    for (const res of results) {
      if (res.png) {
        const base64Data = res.png;
        const filename = `plot_${Date.now()}_${imageCounter++}.png`;
        const localPath = path.join(userVfsDir, filename);

        // Ensure user VFS directory exists
        if (!fs.existsSync(userVfsDir)) {
          fs.mkdirSync(userVfsDir, { recursive: true });
        }

        fs.writeFileSync(localPath, Buffer.from(base64Data, 'base64'));
        downloadedFiles.push({
          filename,
          type: 'image/png',
          base64: base64Data,
        });
      }
      if (res.jpeg || res.jpg) {
        const base64Data = res.jpeg || res.jpg;
        const filename = `plot_${Date.now()}_${imageCounter++}.jpg`;
        const localPath = path.join(userVfsDir, filename);

        if (!fs.existsSync(userVfsDir)) {
          fs.mkdirSync(userVfsDir, { recursive: true });
        }

        fs.writeFileSync(localPath, Buffer.from(base64Data, 'base64'));
        downloadedFiles.push({
          filename,
          type: 'image/jpeg',
          base64: base64Data,
        });
      }
    }

    // Attempt to download any new/modified files in the sandbox workspace back to user VFS
    try {
      const sandboxFiles = await sandbox.files.list();
      for (const sbxFile of sandboxFiles) {
        // Skip default Jupyter/Python directories/files if any
        if (sbxFile.name.startsWith('.') || sbxFile.isDir) continue;

        try {
          const content = await sandbox.files.read(sbxFile.name);
          const localPath = path.join(userVfsDir, sbxFile.name);

          // Write back to local user VFS
          if (!fs.existsSync(userVfsDir)) {
            fs.mkdirSync(userVfsDir, { recursive: true });
          }

          // Convert to buffer if it is read as a string or Uint8Array
          const buffer = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content.buffer || content);
          fs.writeFileSync(localPath, buffer);
          console.log(`[E2B] Synced file back to VFS: ${sbxFile.name}`);
        } catch (readErr) {
          console.error(`[E2B] Failed to sync ${sbxFile.name} back to VFS:`, readErr);
        }
      }
    } catch (listErr) {
      console.error('[E2B] Failed to list sandbox files for VFS sync:', listErr);
    }

    return {
      success: true,
      stdout,
      stderr,
      error,
      files: downloadedFiles,
    };
  } catch (err) {
    console.error('[E2B] Sandbox Execution Error:', err);
    return {
      success: false,
      error: err.message,
      stdout: '',
      stderr: '',
      files: [],
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.close();
      } catch (closeErr) {
        console.error('[E2B] Error closing sandbox:', closeErr);
      }
    }
  }
}
