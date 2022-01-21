import Vue from 'vue'
import throttle from './debounce.js'
import {
  isHtmlElement,
  isFunction,
  isUndefined,
  isDefined
} from '@/utils/types'
import {
  getScrollContainer
} from '@/utils/dom'

const getStyleComputedProperty = (element, property) => {
  if (element === window) {
    element = document.documentElement // 如果element是window对象,则给element赋值为文档对象的根元素,在本例中,是<html>元素,该元素的属性是只读属性
  }

  if (element.nodeType !== 1) { // 如果element不是元素节点,返回空数组
    return []
  }
  // NOTE: 1 DOM access here,如果element的nodeType为1,则是元素节点,执行下列代码
  const css = window.getComputedStyle(element, null) // 获取element的计算样式,简单理解的话,是获取包括定义在css里的所有element的样式
  return property ? css[property] : css // 如果存在property参数,则返回对应的css样式,否则返回包含全部css样式的对象
}

// 这个entries函数,是把对象转换成一个二维数组并返回,数组里的每个元素都是数组,每个数组元素都有两个元素,第一个元素是对象的key,第二个元素是对象的value
const entries = (obj) => {
  return Object.keys(obj || {})
    .map(key => ([key, obj[key]]))
}

// 函数名表示这个函数是获取位置大小,函数执行的代码是,如果参数el是window对象或者document对象,则返回根元素HTML的参数prop对应的属性,否则返回参数el的prop属性,参数el是HTML的元素节点,proo则是元素节点的属性
const getPositionSize = (el, prop) => {
  return el === window || el === document
    ? document.documentElement[prop]
    : el[prop]
}

// 获取el元素的像素高度,该高度包含el元素的垂直内边距边框,且会被四舍五入为整数,如果存在且渲染的水平滚动条，也会包含在内,不包含:before或:after等伪类元素的高度
const getOffsetHeight = el => {
  return getPositionSize(el, 'offsetHeight')
}

// 获取el元素的内部高度,包含内边距,但不包含水平滚动条、边框和外边距,clientHeight是一个只读属性
// eslint-disable-next-line no-unused-vars
const getClientHeight = el => {
  return getPositionSize(el, 'clientHeight')
}

// 定义作用于和需要的属性
const scope = 'ElInfiniteScroll'
const attributes = {
  delay: {
    type: Number,
    default: 200
  },
  distance: {
    type: Number,
    default: 0
  },
  disabled: {
    type: Boolean,
    default: false
  },
  immediate: {
    type: Boolean,
    default: true
  }
}
console.log(entries(attributes))
// 获取滚动选项函数,该函数有两个参数,el和vm,el表示HTML元素节点,vm表示什么暂不知道
const getScrollOptions = (el, vm) => {
  if (!isHtmlElement(el)) return {} // 如果el参数不是HTML元素,返回一个空对象

  /**
   * 否则调用entries函数,这里对entries函数调用,会将常量attributes对象作为参数传入,将attributes对象转换成如下形式
   * [
   *  ["delay", { default: 200, type: f Number() }]
   *  ["distance", { default: 0, type: f Number() }]
   *  ["disabled", { default: false, type: f Boolean() }]
   *  ["immediate", { default: true, type: f Boolean() }]
   * ]
   * 然后调用reduce方法,该reduce函数有两个参数,第一个参数是一个函数,数组中的每个元素都会执行这个函数,并返回函数累计处理的结果。第二个参数是一个空对象,这个参数是reduce函数的可选参数,如果没有提供初始值，则将使用数组中的第一个元素,如果提供该参数,则该参数作为函数第一次调用时的第一个参数的值。
   * reduce方法的第一个参数函数,有四个参数,前两个是必选参数,后两个参数是可选参数。
   * 在本例中,只使用了前两个必选参数,忽略了后两个可选参数。这两个必选参数,分别是accumulator和currentValue,分别表示累计器累计回调的返回值; 它是上一次调用回调时返回的累积值，或initialValue。以及数组中正在处理的元素。
   * 例如：第一次调用,accumulator的值是reduce函数调用时提供的第二个参数-一个空对象。currentValue的值是上面数组的第一个元素,即:["delay", { default: 200, type: f Number() }]。
   * 下面依次分析reduce函数的第一个参数回调函数的函数体:
   * 首先使用ES6的解构赋值获取上面数组的第一个数组元素的第二个元素,即{ default: 200, type: f Number() }里面的type属性和default属性,并且把从default属性取到的值重命名为defaultValue
   * 声明一个value变量,获取el这个HTML元素的infinite-scroll-delay属性值,之所以是infinite-scroll-delay属性,是因为第一次传入的key的值为"delay"字符串,将获取到的属性值赋值给value变量,这个值是一个数字
   * 检测vm[value]的值是否是undefined,如果是,则value的值还是value,如果不是,则value的值赋值为vm[value]
   * 声明一个switch语句,将type作为参数传入,如果type的值为Number,则将value转换成数字,检测value是否为NaN,如果是,则将value赋值为默认值即defaultValue,如果不是NaN,则把value的值还是value
   * 如果type的值是布尔值,则判断value的值是否已定义,如果是则判断value的值是否为字符串false,如果是,则value的值赋值为false,如果不是字符串false,则将value转换成布尔值,如果value的值未定义,则使用defaultValue
   * 如果type既不是数字也不是布尔值,则调用type方法,将type方法的返回值赋值给value
   * 然后让map参数的key值赋值为value。
   * 在第一次调用时,参数map是一个空对象,type的值是Number,defalutValue是200,key的值是delay,value的值要根据用户使用自定义指令时是否设置了infinite-scroll-${key}属性及该属性的值确定
   * 如果用户没有设置infinite-scroll-${key}属性或者用户设置的属性值不是数字或无法转成数字,则value的值是defaultValue即200,如果用户设置了infinite-scroll-${key}属性并且属性值是合法的数字或可以转换成数字,则value的值是用户设置的值
   * 第一次调用后,返回的map是如下结构:
   * {
   *  "delay": 200
   * }
   * 第一次调用完毕后,将依次调用第二次、第三次、第四次,最终map的结构如下:
   * {
   *  "delay": 200 || customValue
   *  "distance": 0 || customValue,
   *  "disabled": false || customValue,
   *  "immediate": true || customValue
   * }
   */
  return entries(attributes).reduce((map, [key, option]) => {
    const { type, default: defaultValue } = option
    let value = el.getAttribute(`scroll-${key}`)
    value = isUndefined(vm[value]) ? value : vm[value]
    switch (type) {
      case Number:
        value = Number(value)
        value = Number.isNaN(value) ? defaultValue : value
        break
      case Boolean:
        value = isDefined(value) ? value === 'false' ? false : Boolean(value) : defaultValue
        break
      default:
        value = type(value)
    }
    map[key] = value
    return map
  }, {})
}

// 声明一个getElementTop函数,该函数获取HTML元素el元素相对于视口的top值,即距离顶部有多高。
// ps:getBoundingClientRect方法获取元素的大小及其相对于视口的位置,如果是标准盒子模型，元素的尺寸等于width/height + padding + border-width的总和。如果box-sizing: border-box，元素的的尺寸等于 width/height
const getElementTop = el => el.getBoundingClientRect().top

/**
 * 声明一个handleScroll函数,从命名上看,可猜测该函数是处理scroll的。
 * 该函数有一个cb参数,从命名上看,该参数应该是一个回调函数,即callback的缩写
 * 下面来看该函数的函数体
 * 从该函数的scope属性里通过解构赋值获取属性el、vm、container、observer
 * 通过解构赋值从调用了getScrollOptions方法的返回值里获取属性distance和disabled,即距离和是否禁用
 * 如果disabled为true,则结束函数运行
 * 否则声明一个名为containerInfo的常量并赋值为container元素调用getBoundingClientRect方法后的返回值,即container的大小及其相对于视口的位置,这是一个对象
 * 判断如果container的width和height都不存在,则结束函数运行
 * 否则声明一个shouldTrigger变量并赋值为false
 * 判断container是否和el相等,如果相等,则声明scrollBottom常量并赋值为container的scrollTop属性的值加上调用参数为container的getClientHeight方法的返回值,即container元素的滚动条距离元素顶部的距离加上container的内部高度,包含内边距,但不包含水平滚动条、边框和外边距
 * 然后将shouldTrigger的值设置为container元素的scrollHeight值减去上面获取到的scrollBottom的值后和distance比较的结果
 * 如果container和el不相等,则声明一个常量heightBelowTop并赋值为调用了参数为el的getOffsetHeight方法的返回值加上getElementTop方法的返回值减去调用了参数为container的getElementTop的返回值的值
 * 即heightBelowTop为el元素的高度,该高度包含el元素的垂直内边距边框,且会被四舍五入为整数,如果存在且渲染的水平滚动条，也会包含在内,不包含:before或:after等伪类元素的高度加上el元素相对于视口的top值,即距离顶部有多高,再减去container元素相对于视口的top值,即距离顶部有多高
 * 声明一个offsetHeight常量并赋值为调用了参数为container的getOffsetHeight函数的返回值,即container元素的高度,该高度包含el元素的垂直内边距边框,且会被四舍五入为整数,如果存在且渲染的水平滚动条，也会包含在内,不包含:before或:after等伪类元素的高度
 * 声明一个borderBottom常量并赋值为container元素的底边框的宽度并将其转换为浮点数
 * 然后将shouldTrigger参数赋值为heightBelowTop减去offsetHeight加上borderBottom后的值与distance的值比较的结果
 * 如果isTrigger的值为true并且cb这个参数是一个函数的话就执行cb.call(vm)
 * 否则判断observer是否为true,是的话执行observer.disconnect()和this[scope].observer = null,暂时不知道这两句代码是啥意思
 */
const handleScroll = function (cb) {
  const { el, vm, container, observer } = this[scope]
  const { distance, disabled } = getScrollOptions(el, vm)

  const scrollTop = el.scrollTop
  console.log(scrollTop)

  if (disabled) return

  const containerInfo = container.getBoundingClientRect()
  if (!containerInfo.width && !containerInfo.height) return

  let shouldTrigger = false

  if (container === el) {
    // be aware of difference between clientHeight & offsetHeight & window.getComputedStyle().height
    // const scrollBottom = container.scrollTop + getClientHeight(container)
    // shouldTrigger = container.scrollHeight - scrollBottom <= distance
    shouldTrigger = container.scrollTop === 0
    // el.scrollTop = 500
  } else {
    const heightBelowTop = getOffsetHeight(el) + getElementTop(el) - getElementTop(container)
    const offsetHeight = getOffsetHeight(container)
    const borderBottom = Number.parseFloat(getStyleComputedProperty(container, 'borderBottomWidth'))
    shouldTrigger = heightBelowTop - offsetHeight + borderBottom <= distance
  }

  if (shouldTrigger && isFunction(cb)) {
    cb.call(vm)
  } else if (observer) {
    observer.disconnect()
    this[scope].observer = null
  }
}

Vue.directive('scroll', {
  inserted (el, binding, vnode) {
    console.log(el)
    console.log(binding)
    console.log(vnode.context)
    const cb = binding.value

    const vm = vnode.context
    // only include vertical scroll
    const container = getScrollContainer(el, true)
    console.log(container)
    const { delay, immediate } = getScrollOptions(el, vm)
    const onScroll = throttle(delay, handleScroll.bind(el, cb))

    el[scope] = { el, vm, container, onScroll }

    if (container) {
      container.addEventListener('scroll', onScroll)

      if (immediate) {
        const observer = el[scope].observer = new MutationObserver(onScroll)
        observer.observe(container, { childList: true, subtree: true })
        onScroll()
      }
    }
  },
  unbind (el) {
    const { container, onScroll } = el[scope]
    if (container) {
      container.removeEventListener('scroll', onScroll)
    }
  }
})
