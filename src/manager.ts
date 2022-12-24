import { Collection, Guild, GuildEmoji, OAuth2Guild } from 'discord.js';
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
            'Transfer',
            'Delete all',
            'Back'
        ]
    }).then(async ManageChoice => {
        if (!fs.existsSync(`./backups`)) fs.mkdirSync(`./backups`);
        require('console-clear')(true);

        switch (ManageChoice.id) {
            // Backup
            case 0:
                console.log('Fetching emotes...');
                let emotes: Collection<string, GuildEmoji> | GuildEmoji[] | null = await guild.emojis.fetch().catch(() => null);
                if (!emotes || !emotes.size) return retry('No emotes were found.');
                emotes = [...emotes.values()];

                require('console-clear')(true);

                console.log(`${emotes.length} emote${emotes.length > 1 ? 's' : ''} were found.`);
                console.log('Backing up...');

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
                const backups = fs.readdirSync('./backups');
                if (!backups.length) return retry('No server backups were found.');

                const guilds: Guild[] = [];
                const availableBackups: any[] = [];
                const values: String[] = [];

                for (const guildBackup of backups) {
                    const guildBackups = fs.readdirSync(`./backups/${guildBackup}`);
                    if (!guildBackups.length) continue;

                    const fetchedGuild = await guild.client.guilds.fetch(guildBackup).catch(() => null);
                    if (!fetchedGuild) continue;

                    guilds.push(fetchedGuild);
                    values.push(`${fetchedGuild.name} (${guildBackups.length} backup${guildBackups.length > 1 ? 's' : ''})`);

                    const guildBackupOptions = [];
                    for (const backup of guildBackups) {
                        const emotes = fs.readdirSync(`./backups/${fetchedGuild.id}/${backup}`);
                        guildBackupOptions.push(`Restore "${backup}"'s available emote${emotes.length > 1 ? 's' : ''}`);
                    }

                    availableBackups.push(guildBackupOptions);
                }

                if (!values.length) return retry('All server backups were unavailable.');

                values.unshift('Cancel');
                return select({
                    values
                }).then(GuildChoice => {
                    if (!GuildChoice.id) return manager(guild);
                    GuildChoice.id = parseInt(`${GuildChoice.id}`);

                    const backupFilesDir = `./backups/${guilds[GuildChoice.id - 1].id}`;
                    const backupFiles = fs.readdirSync(backupFilesDir);

                    const selectedGuild: string[] = availableBackups[GuildChoice.id - 1];
                    selectedGuild.unshift('Cancel');

                    return select({
                        values: selectedGuild
                    }).then(async BackupChoice => {
                        if (!BackupChoice.id) return manager(guild);
                        BackupChoice.id = parseInt(`${BackupChoice.id}`);

                        const emoteFilesDir = `${backupFilesDir}/${backupFiles[BackupChoice.id - 1]}`;
                        const emoteFiles = fs.readdirSync(emoteFilesDir);
                        let restored = 0;

                        setTimeout(() => {
                            if (!restored) {
                                console.log(
                                    'If there is no progress, your IP may be rate limited by the Discord API. Come back in 30-60 Minutes.'
                                );
                            }
                        }, 10_000);

                        for (const emote of emoteFiles) {
                            await guild.emojis.create({
                                name: emote.split('.')[0],
                                attachment: fs.readFileSync(`${emoteFilesDir}/${emote}`)
                            }).then(() => {
                                restored++;
                                console.log(`Restored ${restored}/${emoteFiles.length}`);
                            }).catch(() => {
                                console.log(`Failed to restore "${emote.split('.')[0]}"`);
                            });
                        }

                        require('console-clear')(true);

                        console.log(`Successfully restored ${restored} out of ${emoteFiles.length} emote${emoteFiles.length > 1 ? 's' : ''}`);
                        return setTimeout(() => {
                            manager(guild);
                        }, 5_000);
                    }).catch(() => process.exit(0));
                }).catch(() => process.exit(0));
            // Transfer
            case 2:
                console.log('Fetching servers...');
                let transferGuilds: Collection<string, OAuth2Guild> | OAuth2Guild[] | null = await guild.client.guilds.fetch().catch(() => null);
                if (!transferGuilds || !transferGuilds.size) return retry('No servers were found.');
                transferGuilds = [...transferGuilds.values()];

                for (const transferGuild of transferGuilds) {
                    if (transferGuild.id === guild.id) {
                        transferGuilds.splice(transferGuilds.indexOf(transferGuild), 1);
                        break;
                    }
                }

                if (!transferGuilds.length) return retry('No other servers were found.');

                let transferValues: string[] = [];
                const servers: Guild[] = [];

                for (const transferGuild of transferGuilds) {
                    const fetchedGuild = await guild.fetch().catch(() => null);
                    if (!fetchedGuild) continue;
            
                    const me = await fetchedGuild.members.fetchMe();
                    const hasRequiredPermission = me.permissions.toArray().includes('ManageEmojisAndStickers')
                        || me.permissions.toArray().includes('Administrator');
                    if (!hasRequiredPermission) continue;
            
                    transferValues.push(fetchedGuild.name);
                    servers.push(fetchedGuild);
                }

                if (!transferValues.length) return retry('All server(s) do not have required Manage Emojis and Stickers permission');
                require('console-clear')(true);

                console.log(`Select a server (${transferValues.length})`);

                return select({
                    values: transferValues
                }).then(TransferChoice => {
                    const transferGuild = servers[parseInt(`${TransferChoice.id}`)];
                    console.log(`Transfer server: ${transferGuild.name}`);
                    return select({
                        values: [
                            `Transfer to ${transferGuild.name} from ${guild.name}`,
                            `Transfer from ${transferGuild.name} to ${guild.name}`,
                            `Transfer to ${transferGuild.name} from ${guild.name} (Delete ${transferGuild.name} current emotes)`,
                            `Transfer from ${transferGuild.name} to ${guild.name} (Delete ${guild.name} current emotes)`
                        ]
                    }).then(async TransferTypeChoice => {
                        TransferTypeChoice.id = parseInt(`${TransferTypeChoice.id}`);

                        switch (TransferTypeChoice.id) {
                            // Transfer to TransferGuild from CurrentGuild
                            case 0:
                                console.log('Fetching emotes...');
                                let guildEmotes: Collection<string, GuildEmoji> | GuildEmoji[] | null = await guild.emojis.fetch().catch(() => null);
                                if (!guildEmotes || !guildEmotes.size) return retry('No emotes were found.');
                                guildEmotes = [...guildEmotes.values()];
                                let transferred1 = 0;

                                for (const guildEmote of guildEmotes) {
                                    if (!guildEmote.name) continue;
                                    await transferGuild.emojis.create({
                                        name: guildEmote.name,
                                        attachment: guildEmote.url
                                    }).then(() => {
                                        transferred1++;
                                        console.log(`Transferred ${transferred1}/${(guildEmotes as GuildEmoji[]).length}`);
                                    }).catch(() => {
                                        console.log(`Failed to transfer "${guildEmote.name}"`);
                                    });
                                }

                                require('console-clear')(true);

                                console.log(`Successfully restored ${transferred1} out of ${guildEmotes.length} emote${guildEmotes.length > 1 ? 's' : ''}`);
                                return setTimeout(() => {
                                    manager(guild);
                                }, 5_000);
                            // Transfer from TransferGuild to CurrentGuild
                            case 1:
                                console.log('Fetching emotes...');
                                let transferGuildEmotes: Collection<string, GuildEmoji> | GuildEmoji[] | null = await transferGuild.emojis.fetch().catch(() => null);
                                if (!transferGuildEmotes || !transferGuildEmotes.size) return retry('No emotes were found.');
                                transferGuildEmotes = [...transferGuildEmotes.values()];
                                let transferred2 = 0;

                                for (const guildEmote of transferGuildEmotes) {
                                    if (!guildEmote.name) continue;
                                    await guild.emojis.create({
                                        name: guildEmote.name,
                                        attachment: guildEmote.url
                                    }).then(() => {
                                        transferred3++;
                                        console.log(`Transferred ${transferred2}/${(transferGuildEmotes as GuildEmoji[]).length}`);
                                    }).catch(() => {
                                        console.log(`Failed to transfer "${guildEmote.name}"`);
                                    });
                                }

                                require('console-clear')(true);

                                console.log(`Successfully restored ${transferred2} out of ${transferGuildEmotes.length} emote${transferGuildEmotes.length > 1 ? 's' : ''}`);
                                return setTimeout(() => {
                                    manager(guild);
                                }, 5_000);
                            // Transfer to TransferGuild from CurrentGuild (Delete TransferGuild current emotes)
                            case 2:
                                console.log('Fetching emotes...');
                                let guildEmotesDelete: Collection<string, GuildEmoji> | GuildEmoji[] | null = await guild.emojis.fetch().catch(() => null);
                                if (!guildEmotesDelete || !guildEmotesDelete.size) return retry('No emotes were found.');
                                guildEmotesDelete = [...guildEmotesDelete.values()];
                                let transferred3 = 0;

                                for (const guildEmote of guildEmotesDelete) {
                                    if (!guildEmote.name) continue;
                                    await transferGuild.emojis.create({
                                        name: guildEmote.name,
                                        attachment: guildEmote.url
                                    }).then(() => {
                                        transferred3++;
                                        console.log(`Transferred ${transferred3}/${(guildEmotes as GuildEmoji[]).length}`);
                                    }).catch(() => {
                                        console.log(`Failed to transfer "${guildEmote.name}"`);
                                    });
                                }

                                require('console-clear')(true);

                                console.log(`Successfully restored ${transferred3} out of ${guildEmotesDelete.length} emote${guildEmotesDelete.length > 1 ? 's' : ''}`);
                                return setTimeout(() => {
                                    manager(guild);
                                }, 5_000);
                            // Transfer from TransferGuild to CurrentGuild (Delete CurrentGuild current emotes)
                            case 3:
                                console.log('Fetching emotes...');
                                let transferGuildEmotesDelete: Collection<string, GuildEmoji> | GuildEmoji[] | null = await transferGuild.emojis.fetch().catch(() => null);
                                if (!transferGuildEmotesDelete || !transferGuildEmotesDelete.size) return retry('No emotes were found.');
                                transferGuildEmotesDelete = [...transferGuildEmotesDelete.values()];
                                let transferred4 = 0;

                                for (const guildEmote of transferGuildEmotesDelete) {
                                    if (!guildEmote.name) continue;
                                    await guild.emojis.create({
                                        name: guildEmote.name,
                                        attachment: guildEmote.url
                                    }).then(() => {
                                        transferred3++;
                                        console.log(`Transferred ${transferred2}/${(transferGuildEmotes as GuildEmoji[]).length}`);
                                    }).catch(() => {
                                        console.log(`Failed to transfer "${guildEmote.name}"`);
                                    });
                                }

                                require('console-clear')(true);

                                console.log(`Successfully restored ${transferred4} out of ${transferGuildEmotesDelete.length} emote${transferGuildEmotesDelete.length > 1 ? 's' : ''}`);
                                return setTimeout(() => {
                                    manager(guild);
                                }, 5_000);
                        }
                    }).catch(() => process.exit(0));
                }).catch(() => process.exit(0));
            // Delete all
            case 3:
                console.log('Are you sure you want to delete all emotes?');
                return select({
                    values: [
                        'Yes',
                        'No'
                    ]
                }).then(async DeleteChoice => {
                    if (DeleteChoice.id) return manager(guild);
                    require('console-clear')(true);

                    console.log('Fetching emotes...');
                    let emotesToDelete: Collection<string, GuildEmoji> | GuildEmoji[] | null = await guild.emojis.fetch().catch(() => null);
                    if (!emotesToDelete || !emotesToDelete.size) return retry('No emotes were found.');
                    emotesToDelete = [...emotesToDelete.values()];
                    console.log('Deleting...');
                    let deleted = 0;

                    for (const emote of emotesToDelete) {
                        if (emote.deletable) await emote.delete().then(() =>{
                            deleted++;
                            console.log(`Deleted "${emote.name}"`);
                        }).catch(() => {
                            console.log(`Failed to delete "${emote.name}"`);
                        });
                    }

                    require('console-clear')(true);
                    console.log(`Deleted ${deleted} out of ${emotesToDelete.length} emote${emotesToDelete.length > 1 ? 's' : ''}`);

                    return setTimeout(() => {
                        manager(guild);
                    }, 5_000);
                }).catch(() => process.exit(0));
            // Back
            case 4:
                return Main();
        }
    }).catch(() => process.exit(0));
}