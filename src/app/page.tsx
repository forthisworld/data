import { redirect } from 'next/navigation';

/** The atlas starts at India. */
export default function Home() {
    redirect('/in');
}
