const formatWord = (word) => {
  if (!/[a-z]/i.test(word)) return word;
  if (/^[A-Z0-9]{2,5}$/.test(word)) return word;

  const lower = word.toLocaleLowerCase();
  if (word === lower || word === word.toLocaleUpperCase()) {
    return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
  }

  return word;
};

export default function formatDisplayValue(value, fallback = "—") {
  if (value === null || value === undefined || !String(value).trim()) {
    return fallback;
  }

  return String(value)
    .trim()
    .replace(/_+/g, " ")
    .split(/(\s+)/)
    .map((part) =>
      /^\s+$/.test(part)
        ? part
        : part.split(/([-’'])/).map(formatWord).join("")
    )
    .join("");
}
