import select from 'cli-select';
import { Main } from '.';

export default function (error: string) {
    require('console-clear')(true);
    console.log(error);
    console.log('Restart EmotiManager?');

    select({
        values: [
            'Yes',
            'No'
        ]
    }).then(choice => {
        switch (choice.id) {
            case 0:
                return Main();
            case 1:
                process.exit(1);
        }
    }).catch(() => process.exit(1));
}