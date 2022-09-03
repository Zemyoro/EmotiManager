import { Client } from 'discord.js';
import select from 'cli-select';
import 'dotenv/config';
import retry from './retry';
import { manager } from './manager';

const client = new Client({
    intents: ['Guilds', 'GuildEmojisAndStickers']
});

export async function Main() {
    require('console-clear')(true);

    console.log('Fetching servers...');
    await client.guilds.fetch();
    console.log('Loading servers...');
    const servers = [...(client.guilds.cache.values())];
    if (!servers.length) return retry('No servers found');

    // Server names
    const values = [];

    for (const server of servers) {
        const hasRequiredPermission = (await server.members.fetchMe())
            ?.permissions.toArray().includes('ManageEmojisAndStickers');
        if (!hasRequiredPermission) continue;
        values.push(server.name);
    }

    if (!values.length) return retry('All server(s) do not have required Manage Emojis and Stickers permission');
    require('console-clear')(true);

    console.log(`Select a server (${values.length})`);

    select({
        values
    }).then(choice => {
        return manager(servers[parseInt(`${choice.id}`)]);
    }).catch(() => process.exit(0));
}

client.on('ready', () => {
    Main();
});

console.log('Logging in...');
client.login(process.env.TOKEN);