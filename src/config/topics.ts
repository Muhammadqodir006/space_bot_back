export const TOPICS = [
  { key: "apod", label: "🌌 Kunlik rasm (APOD)" },
  { key: "mars", label: "🔴 Mars" },
  { key: "space_weather", label: "☄️ Kosmik ob-havo" },
  { key: "meteor", label: "🌠 Meteor yomg'irlari" },
  { key: "planets", label: "🪐 Yangi sayyoralar" },
] as const;

export type TopicKey = (typeof TOPICS)[number]["key"];

export function isTopic(value: string): value is TopicKey {
    return TOPICS.some((t) => t.key === value);
}