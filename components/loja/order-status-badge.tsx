import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_VARIANT, statusLabel } from "@/lib/orders/fsm";
import type { FulfillmentType, OrderStatus } from "@/types/db";

export function OrderStatusBadge({
  status,
  fulfillment,
}: {
  status: OrderStatus;
  fulfillment?: FulfillmentType;
}) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{statusLabel(status, fulfillment)}</Badge>;
}
