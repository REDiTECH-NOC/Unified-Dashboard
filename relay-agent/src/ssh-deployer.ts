import { NodeSSH } from "node-ssh";
import { log } from "./logger.js";
import type { TaskPayload } from "./api-client.js";

/**
 * Deploy SSO files to a 3CX PBX via SSH/SFTP.
 * Connects, writes each file via SFTP, verifies they exist, disconnects.
 */
export async function deploySsoFiles(payload: TaskPayload): Promise<void> {
  const ssh = new NodeSSH();
  const label = `${payload.instanceName || payload.localIp} (${payload.fqdn || ""})`;

  log.info(`Connecting to ${payload.localIp} as ${payload.sshUsername}...`);

  await ssh.connect({
    host: payload.localIp,
    username: payload.sshUsername,
    password: payload.sshPassword,
    readyTimeout: 10_000,
    // PBXs are on the LAN — accept unknown host keys
    algorithms: {
      serverHostKey: [
        "ssh-ed25519",
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "rsa-sha2-512",
        "rsa-sha2-256",
        "ssh-rsa",
      ],
    },
  });

  try {
    // Ensure target directory exists
    const mkdirResult = await ssh.execCommand(
      `mkdir -p '${payload.targetPath}'`
    );
    if (mkdirResult.code !== 0) {
      throw new Error(`Failed to create directory: ${mkdirResult.stderr}`);
    }

    if (!payload.files?.length) {
      throw new Error("No files provided in task payload");
    }

    // Write each file via SFTP
    const sftp = await ssh.requestSFTP();

    for (const file of payload.files) {
      const remotePath = `${payload.targetPath}${file.name}`;
      log.info(`Writing ${file.name} to ${remotePath}...`);

      await new Promise<void>((resolve, reject) => {
        const stream = sftp.createWriteStream(remotePath);
        stream.on("close", () => resolve());
        stream.on("error", (err: Error) => reject(err));
        stream.end(Buffer.from(file.content, "utf-8"));
      });
    }

    // Verify all files exist
    for (const file of payload.files) {
      const remotePath = `${payload.targetPath}${file.name}`;
      const check = await ssh.execCommand(
        `test -f '${remotePath}' && echo OK`
      );
      if (!check.stdout.includes("OK")) {
        throw new Error(
          `Verification failed: ${file.name} not found after deployment`
        );
      }
    }

    log.info(`SSO files deployed to ${label}`);
  } finally {
    ssh.dispose();
  }
}

/**
 * Remove SSO files from a 3CX PBX via SSH.
 */
export async function removeSsoFiles(payload: TaskPayload): Promise<void> {
  const ssh = new NodeSSH();
  const label = `${payload.instanceName || payload.localIp} (${payload.fqdn || ""})`;

  log.info(`Connecting to ${payload.localIp} as ${payload.sshUsername}...`);

  await ssh.connect({
    host: payload.localIp,
    username: payload.sshUsername,
    password: payload.sshPassword,
    readyTimeout: 10_000,
    algorithms: {
      serverHostKey: [
        "ssh-ed25519",
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "rsa-sha2-512",
        "rsa-sha2-256",
        "ssh-rsa",
      ],
    },
  });

  try {
    if (!payload.fileNames?.length) {
      throw new Error("No file names provided for removal");
    }

    for (const fileName of payload.fileNames) {
      const remotePath = `${payload.targetPath}${fileName}`;
      log.info(`Removing ${remotePath}...`);

      const result = await ssh.execCommand(`rm -f '${remotePath}'`);
      if (result.code !== 0) {
        throw new Error(`Failed to remove ${fileName}: ${result.stderr}`);
      }
    }

    // Verify files are gone
    for (const fileName of payload.fileNames) {
      const remotePath = `${payload.targetPath}${fileName}`;
      const check = await ssh.execCommand(
        `test -f '${remotePath}' && echo EXISTS || echo GONE`
      );
      if (check.stdout.includes("EXISTS")) {
        throw new Error(`Removal failed: ${fileName} still exists`);
      }
    }

    log.info(`SSO files removed from ${label}`);
  } finally {
    ssh.dispose();
  }
}
