import { Client, Collection, Guild, OAuth2Guild } from 'discord.js';
import { manager } from './manager';
import select from 'cli-select';
import retry from './retry';
import 'dotenv/config';

const client = new Client({
    intents: ['Guilds', 'GuildEmojisAndStickers']
});

export async function Main() {
    require('console-clear')(true);

    console.log('Fetching servers...');
    let guilds: Collection<string, OAuth2Guild> | OAuth2Guild[] | null = await client.guilds.fetch().catch(() => null);
    if (!guilds || !guilds.size) return retry('No servers were found.');
    guilds = [...guilds.values()];

    // Server names
    const values: string[] = [];
    const servers: Guild[] = [];

    for (const guild of guilds) {
        const fetchedGuild = await guild.fetch().catch(() => null);
        if (!fetchedGuild) continue;

        const me = await fetchedGuild.members.fetchMe();
        const hasRequiredPermission = me.permissions.toArray().includes('ManageEmojisAndStickers')
            || me.permissions.toArray().includes('Administrator');
        if (!hasRequiredPermission) continue;

        values.push(fetchedGuild.name);
        servers.push(fetchedGuild);
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

client.on('ready', async () => {
    return Main();
});

console.log('Logging in...');
void client.login(process.env.TOKEN);