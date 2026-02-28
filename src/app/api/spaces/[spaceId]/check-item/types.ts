export interface CheckableItem {
  item: string;
  checked: boolean;
}

export interface CheckItemResponse {
  success: boolean;
  item: CheckableItem;
  nodeId: string;
  itemIndex: number;
  checked: boolean;
}
