import {env} from "../config/env";

export interface NasaApod {
    date: string;
    title: string;
    explanation: string;
    media_type: string;
    url: string;
    hdurl?: string;
    copyright?: string;
}

export async function fetchApodFromNasa(date: string): Promise<NasaApod> {
    const url = new URL("https://api.nasa.gov/planetary/apod");
    url.searchParams.set("api_key", env.NASA_API_KEY);
    url.searchParams.set("date", date);

    const res = await fetch(url);
    if(!res.ok) {
        throw new Error(`NASA APOD xatosi: ${res.status}`);
    }
    return (await res.json()) as NasaApod;
}