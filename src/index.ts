import { Client } from 'discord.js';
import { manager } from './manager';
import select from 'cli-select';
import retry from './retry';
import 'dotenv/config';

const client = new Client({
    intents: ['Guilds', 'GuildEmojisAndStickers']
});

export async function Main() {
    require('console-clear')(true);
    console.log('Refreshing servers...');
    await client.guilds.fetch();
    console.log('Loading servers...');

    const guilds = [...(client.guilds.cache.values())];
    if (!guilds.length) return retry('No servers found');
    const values = [];

    for (const guild of guilds) {
        const permission = (await guild.members.fetchMe())?.permissions.toArray().includes('ManageEmojisAndStickers');
        if (!permission) continue;
        values.push(guild.name);
    }

    if (!values.length) {
        return retry('No servers found (Unavailable servers don\'t have required permissions)');
    }

    require('console-clear')(true);
    console.log(`Select a server (${values.length})`);

    select({
        values
    }).then(choice => {
        return manager(guilds[parseInt(`${choice.id}`)])
    }).catch(() => process.exit(0));
}

client.on('ready', () => {
    Main();
});

console.log('Logging in...');
client.login(process.env.TOKEN);