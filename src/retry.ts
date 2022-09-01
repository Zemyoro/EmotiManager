import select from 'cli-select';
import { Main } from '.';

export default function(error: string) {
    console.log(error);
    console.log('Retry?');

    select({
        values: ['Yes', 'No']
    }).then(choice => {
        switch (choice.id) {
            case 0:
                return Main();
            case 1:
                process.exit(1);
        }
    }).catch(() => process.exit(1));
}