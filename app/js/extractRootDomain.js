/* @flow */

import extractHostname from './extractHostname';

// Original code from https://stackoverflow.com/a/23945027/368697.
export default function extractRootDomain(url: string): string {
  let domain = extractHostname(url);
  const splitArr = domain.split('.');
  const arrLen = splitArr.length;

  //extracting the root domain here if there is a subdomain
  if (arrLen > 2) {
    domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    //check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
    if (splitArr[arrLen - 1].length === 2 && splitArr[arrLen - 2].length === 2) {
      //this is using a ccTLD
      domain = splitArr[arrLen - 3] + '.' + domain;
    }
  }
  return domain;
}
