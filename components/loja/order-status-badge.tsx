import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_VARIANT, STATUS_LABEL } from "@/lib/orders/fsm";
import type { OrderStatus } from "@/types/db";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
