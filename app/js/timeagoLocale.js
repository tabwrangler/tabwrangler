// @flow

import * as langs from "timeago.js/lib/lang";

type TimeagoLocale = (number: number, index: number) => [string, string];

const timeagoLocale = {
  get ar(): TimeagoLocale {
    return langs["ar"];
  },
  get be(): TimeagoLocale {
    return langs["be"];
  },
  get bg(): TimeagoLocale {
    return langs["bg"];
  },
  get ca(): TimeagoLocale {
    return langs["ca"];
  },
  get da(): TimeagoLocale {
    return langs["da"];
  },
  get de(): TimeagoLocale {
    return langs["de"];
  },
  get el(): TimeagoLocale {
    return langs["el"];
  },
  get en(): TimeagoLocale {
    return langs["en_US"];
  },
  get en_short(): TimeagoLocale {
    return langs["en_short"];
  },
  get es(): TimeagoLocale {
    return langs["es"];
  },
  get eu(): TimeagoLocale {
    return langs["eu"];
  },
  get fa(): TimeagoLocale {
    return langs["fa"];
  },
  get fi(): TimeagoLocale {
    return langs["fi"];
  },
  get fr(): TimeagoLocale {
    return langs["fr"];
  },
  get he(): TimeagoLocale {
    return langs["he"];
  },
  get hu(): TimeagoLocale {
    return langs["hu"];
  },
  get in_BG(): TimeagoLocale {
    return langs["bn_IN"];
  },
  get in_HI(): TimeagoLocale {
    return langs["hi_IN"];
  },
  get in_ID(): TimeagoLocale {
    return langs["id_ID"];
  },
  get it(): TimeagoLocale {
    return langs["it"];
  },
  get ja(): TimeagoLocale {
    return langs["ja"];
  },
  get ko(): TimeagoLocale {
    return langs["ko"];
  },
  get ml(): TimeagoLocale {
    return langs["ml"];
  },
  get my(): TimeagoLocale {
    return langs["my"];
  },
  get nb_NO(): TimeagoLocale {
    return langs["nb_NO"];
  },
  get nl(): TimeagoLocale {
    return langs["nl"];
  },
  get nn_NO(): TimeagoLocale {
    return langs["nn_NO"];
  },
  get pl(): TimeagoLocale {
    return langs["pl"];
  },
  get pt_BR(): TimeagoLocale {
    return langs["pt_BR"];
  },
  get ro(): TimeagoLocale {
    return langs["ro"];
  },
  get ru(): TimeagoLocale {
    return langs["ru"];
  },
  get sv(): TimeagoLocale {
    return langs["sv"];
  },
  get ta(): TimeagoLocale {
    return langs["ta"];
  },
  get th(): TimeagoLocale {
    return langs["th"];
  },
  get tr(): TimeagoLocale {
    return langs["tr"];
  },
  get uk(): TimeagoLocale {
    return langs["uk"];
  },
  get vi(): TimeagoLocale {
    return langs["vi"];
  },
  get zh_CN(): TimeagoLocale {
    return langs["zh_CN"];
  },
  get zh_TW(): TimeagoLocale {
    return langs["zh_TW"];
  },
};

export default timeagoLocale;
