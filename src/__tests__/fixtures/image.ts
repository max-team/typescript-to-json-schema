/**
 * @file image
 * @author cxtom(cxtom2008@gmail.com)
 */

import {numberic, integer} from '../../index';

/**
 * 简单的图片
 */
interface ImageBase {
    type?: "timg" | "online";
    /**
     * 图片链接
     *
     * @format uri
     * @default http://mms-mis.cdn.bcebos.com/graph/2057/star/actor146.jpg
     */
    src: string;
}

/**
 * Timg 服务
 */
interface Timg extends ImageBase {
    type: "timg";
    /** 拼链接参数 */
    params?: {
        /**
         * 图片裁剪参数，默认为8，有以下几种含义：
         *  1. 纯数字(例如 3)：如果大于8则设置转换后图片为最大图片大小，如果小于1则设置为默认图片大小4；
         *  2. b开始(例如 b320_120): 按照将'_'前后的数字分别作为目的图片的最大宽度和高度(如果读取失败则采用timg服务默认最大宽度和高度)；
         *  3. p开始(例如 p800): 将p后面的数字作为目的图片的最大像素限制；
         *  4. w开始(例如 w320): 将w后面的数字作为目的图片最大宽度限制；
         *  5. h开始(例如 h240): 将h后面的数字作为目的图片最大高度限制；
         *  6. f开始(例如 f100_100)：WTN专有裁剪策略，依据图片宽高比裁剪感兴趣区域；
         *  7. u开始(例如 u10050): '_'前后的数字分别为压缩后图片宽高，支持非等比缩放
         *
         * @pattern ^([bpwhfu][\\d_]+|[1-8])$
         * @minimum 1
         * @maximum 8
         * @default 8
         */
        cuttype?: integer | string;
        /**
         * 用于指定目的图片质量，数值越大，质量越好(最多与原图持平)
         *
         * @minimum 0
         * @maximum 100
         * @default 60
         */
        size?: integer;
    }
}

/**
 * 在线裁剪服务
 */
interface OnlineCut extends ImageBase {

    type: "online";

    /** 裁剪参数 */
    params?: {
        /**
         * 图片宽比例
         *
         * @default 3
         */
        sw?: integer;
        /**
         * 图片高比例
         *
         * @default 2
         */
        sh?: number;
        /**
         * 图片栅格化数
         *
         * @default 4
         */
        grid?: number;
        /**
         * 图片裁剪方式，普通裁剪可不传，ct=5 为 5：2 大图裁剪
         */
        ct?: numberic;
        /**
         * 可扩展图片特殊处理方式，参数不做校验，直接拼接在 url 中
         */
        sp?: string;
    }
}

export type Image = ImageBase | Timg | OnlineCut;
