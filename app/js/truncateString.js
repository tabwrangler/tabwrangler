/* @flow */

export default function truncateString(str: ?string, length: number): ?string {
  return str == null || str.length <= (length + 3) ? str : `${str.substring(0, length)}...`;
}
