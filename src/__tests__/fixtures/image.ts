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
         * 图片裁剪参数，默认为8
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

    /** 数组 */
    test: Array<string>
}

export type Image = ImageBase | Timg | OnlineCut;
