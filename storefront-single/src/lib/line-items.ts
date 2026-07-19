import type { CartProductType } from './types'

type ProductLineItem = {
  productType: CartProductType
  productName: string
  quantity: number
  unitPrice: number
  slug: string
  shortName: string
}

export type DisplayLineItem = ProductLineItem

export function getLineItemUnitPrice(item: DisplayLineItem): number {
  return item.unitPrice
}

export function getLineItemTotal(item: DisplayLineItem): number {
  return getLineItemUnitPrice(item) * item.quantity
}

export function getLineItemAltText(item: DisplayLineItem): string {
  return item.productName
}

export function getLineItemVariantSummary(item: DisplayLineItem): string {
  return item.shortName
}

export function getMerchantLineItemVariantSummary(item: DisplayLineItem): string {
  return item.shortName
}
