import type { ProductCategory } from '@/site.config'

// Cart product-type id IS the category key.
export type CartProductType = ProductCategory

interface CartItemBase {
  id: string
  productType: CartProductType
  productName: string
  quantity: number
  image: string
  unitPrice: number
  slug: string
  shortName: string
}

export type CartItemData = CartItemBase
