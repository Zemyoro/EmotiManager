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
            'Delete all',
            'Back'
        ]
    }).then(async choice => {
        switch (choice.id) {
            // Backup
            case 0:
                require('console-clear')(true);

                console.log('Fetching emotes...');
                await guild.emojis.fetch();

                console.log('Loading emotes...');
                const emotes = [...guild.emojis.cache.values()];
                if (!emotes.length) return retry('No emotes found');

                require('console-clear')(true);

                console.log(`${emotes.length} emote${emotes.length > 1 ? 's' : ''} found`);
                console.log('Backing up....');

                if (!fs.existsSync(`./backups`)) fs.mkdirSync(`./backups`);
                if (!fs.existsSync(`./backups/${guild.id}`)) fs.mkdirSync(`./backups/${guild.id}`);

                const backupNumber = fs.readdirSync(`./backups/${guild.id}`).length + 1;

                if (!fs.existsSync(`./backups/${guild.id}/${backupNumber}`))
                    fs.mkdirSync(`./backups/${guild.id}/${backupNumber}`);

                for (const i in emotes) {
                    const download = await (await fetch(emotes[i].url)).buffer();
                    const fileName = `${emotes[i].name}.${emotes[i].animated ? 'gif' : 'webp'}`;
                    fs.writeFileSync(`./backups/${guild.id}/${backupNumber}/${fileName}`, download);
                    console.log(`Backed up ${parseInt(i) + 1}/${emotes.length}`);
                }

                require('console-clear')(true);
                console.log(`Successfully backed up ${emotes.length} emote${emotes.length > 1 ? 's' : ''}`);

                return setTimeout(() => {
                    manager(guild);
                }, 5_000);
            // Restore
            case 1:
                const serversInBackups = fs.readdirSync('./backups');
                if (!serversInBackups.length) return retry('No backups found');

                const servers: Guild[] = [];
                const values: String[] = [];
                const backupOptions: any[] = [];

                for (const server of serversInBackups) {
                    const backups = fs.readdirSync(`./backups/${server}`);
                    if (!backups.length) continue;

                    const fetchedServer = await guild.client.guilds.fetch(server).catch(() => null);
                    if (!fetchedServer) continue;

                    servers.push(fetchedServer);
                    values.push(`${fetchedServer.name} (${backups.length} backup${backups.length > 1 ? 's' : ''})`);

                    const backupOptionsTMP = [];
                    for (const backup of backups) {
                        const emotes = fs.readdirSync(`./backups/${fetchedServer.id}/${backup}`);
                        backupOptionsTMP.push(`Restore to "${backup}" (${emotes.length} emote${emotes.length > 1 ? 's' : ''})`);
                    }

                    backupOptions.push(backupOptionsTMP);
                }

                if (!values.length) return retry('All backed up servers were unavailable');

                values.unshift('Cancel');
                return select({
                    values
                }).then(serverChoice => {
                    if (!serverChoice.id) return manager(guild);

                    const backupFilesDir = `./backups/${servers[parseInt(`${serverChoice.id}`) - 1].id}`;
                    const backupFiles = fs.readdirSync(backupFilesDir);

                    const selectedServer: String[] = backupOptions[parseInt(`${choice.id}`)];
                    selectedServer.unshift('Cancel');

                    return select({
                        values: selectedServer
                    }).then(async backupChoice => {
                        if (!backupChoice.id) return manager(guild);

                        const emoteFilesDir = `${backupFilesDir}/${backupFiles[parseInt(`${backupChoice.id}`) - 1]}`;
                        const emotesFiles = fs.readdirSync(emoteFilesDir);
                        let restored = 0;

                        setTimeout(() => {
                            if (!restored) {
                                console.log(
                                    'Your IP may be ratelimited by Discord. Please come back in 30-60 Minutes.'
                                );
                            }
                        }, 5_000);

                        for (const emote of emotesFiles) {
                            await guild.emojis.create({
                                name: emote.split('.')[0],
                                attachment: fs.readFileSync(`${emoteFilesDir}/${emote}`)
                            }).then(() => {
                                restored++;
                                console.log(`Restored ${restored}/${emotesFiles.length}`);
                            }).catch(() => {
                                console.log(`Failed to restore "${emote.split('.')[0]}"`);
                            });
                        }

                        require('console-clear')(true);

                        console.log(`Successfully restored ${restored} out of ${emotesFiles.length} emotes`);
                        return setTimeout(() => {
                            manager(guild);
                        }, 5_000);
                    }).catch(() => process.exit(0));
                }).catch(() => process.exit(0));
            // Delete all
            case 2:
                require('console-clear')(true);

                console.log('Are you sure you want to delete all emotes?');
                return select({
                    values: [
                        'Yes',
                        'No'
                    ]
                }).then(async choice => {
                    if (choice.id === 1) return manager(guild);
                    require('console-clear')(true);

                    await guild.emojis.fetch();
                    console.log('Deleting...');

                    const emotesToDelete = [...guild.emojis.cache.values()];
                    if (!emotesToDelete) return;

                    for (const emote of emotesToDelete) {
                        if (emote.deletable) await emote.delete();
                        console.log(`Deleted "${emote.name}"`);
                    }

                    require('console-clear')(true);
                    console.log(`Deleted ${emotesToDelete.length} emote${emotesToDelete.length > 1 ? 's' : ''}`);

                    return setTimeout(() => {
                        manager(guild);
                    }, 5_000);
                }).catch(() => manager(guild));
            // Back
            case 3:
                return Main();
        }
    }).catch(() => process.exit(0));
}