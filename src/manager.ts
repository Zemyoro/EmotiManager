import { Guild } from 'discord.js';
import select from 'cli-select';
import fetch from 'node-fetch';
import retry from './retry';
import { Main } from '.';
import fs from 'fs';

export function manager(guild: Guild) {
    require('console-clear')(true);
    console.log(`Managing ${guild.name}`);

    select({
        values: [
            'Backup',
            'Restore',
            'Delete All (NOT RECOVERABLE)',
            'Back'
        ]
    }).then(async choice => {

        switch (choice.id) {
            // Backup
            case 0:
                console.log('Refreshing emotes...');
                await guild.emojis.fetch();
                console.log('Loading emotes...');

                const emotes = [...guild.emojis.cache.values()];
                if (!emotes) return retry('No emotes found');

                require('console-clear')(true);
                console.log(`${emotes.length} emote${emotes.length > 1 ? 's' : ''} found`);
                console.log('Backing up...');

                if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');
                if (!fs.existsSync(`./backups/${guild.id}`)) fs.mkdirSync(`./backups/${guild.id}`);

                const amount = fs.readdirSync(`./backups/${guild.id}`);
                const backupNum = amount.length + 1;
                if (!fs.existsSync(`./backups/${guild.id}/${backupNum}`))
                    fs.mkdirSync(`./backups/${guild.id}/${backupNum}`);

                for (const i in emotes) {
                    const download = await (await fetch(emotes[i].url)).buffer();
                    const fileName = `${emotes[i].name}.${emotes[i].animated ? 'gif' : 'webp'}`;
                    fs.writeFileSync(`./backups/${guild.id}/${backupNum}/${fileName}`, download);
                }

                require('console-clear')(true);
                console.log(`Successfully backed up ${emotes.length} emote${emotes.length > 1 ? 's' : ''}`);

                return setTimeout(() => {
                    manager(guild);
                }, 5_000);
            // Restore
            case 1:
                const backups = fs.readdirSync('./backups');
                if (!backups.length) return retry('No backups found');

                const guilds: Guild[] = [];
                const values = [];
                const backupEach: any[] = [];

                for (const backup of backups) {
                    const serverBackups = fs.readdirSync(`./backups/${backup}`);
                    if (!serverBackups.length) continue;
                    const server = await guild.client.guilds.fetch(backup).catch(() => null);
                    if (!server) continue;
                    guilds.push(server);
                    values.push(`${server.name} (${serverBackups.length} backup${serverBackups.length > 1 ? 's' : ''})`);

                    let tmp = [];
                    for (const serverBackup of serverBackups) {
                        const emotes = fs.readdirSync(`./backups/${server.id}/${serverBackup}`);
                        tmp.push(`Restore to "${serverBackup}" (${emotes.length} emote${emotes.length > 1 ? 's' : ''})`);
                    }

                    backupEach.push(tmp);
                }

                if (!values.length) {
                    return retry('No backups found (Unavailable servers had no backups or servers were invalid)');
                }

                values.unshift('Cancel');
                return select({
                    values
                }).then(serverChoice => {
                    if (!serverChoice.id) return manager(guild);
                    const selected = backupEach[parseInt(`${choice.id}`) - 1];
                    selected.unshift('Cancel');

                    return select({
                        values: selected
                    }).then(async choice => {
                        if (!choice.id) return manager(guild);
                        const backupFiles = fs.readdirSync(`./backups/${guilds[parseInt(`${serverChoice.id}`) - 1].id}`);
                        const emoteFiles = fs.readdirSync(`./backups/${guilds[parseInt(`${serverChoice.id}`) - 1].id}/${backupFiles[parseInt(`${choice.id}`) - 1]}`);
                        
                        let restored = 0;

                        setTimeout(() => {
                            if (!restored) {
                                console.log('Your IP may be ratelimited by Discord. Come back within 30-60 Minutes.');
                            }
                        }, 20_000);

                        for (const emote of emoteFiles) {
                            await guild.emojis.create({
                                name: emote.split('.')[0],
                                attachment: fs.readFileSync(`./backups/${guilds[parseInt(`${serverChoice.id}`) - 1].id}/${backupFiles[parseInt(`${choice.id}`) - 1]}/${emote}`) 
                            }).then(() => {
                                restored++;
                                console.log(`Restored ${restored}/${emoteFiles.length}`);
                            }).catch(() => {
                                console.log(`Failed to restore ${emote.split('.')[0]}`);
                                return null;
                            });
                        }

                        console.log(`Successfully restored ${emoteFiles.length} emote${emoteFiles.length > 1 ? 's' : ''} from "${backupFiles[parseInt(`${choice.id}`) - 1]}"`);

                        return setTimeout(() => {
                            manager(guild);
                        }, 5_000);
                    }).catch(() => process.exit(0));
                }).catch(() => process.exit(0));
            // Delete All
            case 2:
                require('console-clear')(true);
                console.log('No going back now...');
                await guild.emojis.fetch();
                console.log('Deleting...');

                const emotesToDelete = [...guild.emojis.cache.values()];
                if (!emotesToDelete.length) retry('No emotes found');

                for (const emote of emotesToDelete) {
                    if (emote.deletable) await emote.delete();
                }

                console.log(`Deleted ${emotesToDelete.length} emote${emotesToDelete.length > 1 ? 's' : ''}`);

                return setTimeout(() => {
                    manager(guild);
                }, 5_000);
            case 3:
                return Main();
        }

    }).catch(() => process.exit(0));
}