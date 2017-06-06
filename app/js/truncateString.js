export default function truncateString(str, length) {
  return str == null || str.length <= (length + 3) ? str : `${str.substring(0, length)}...`;
}
