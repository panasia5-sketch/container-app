export type Locale = "ko" | "en";

const ko = {
  app: {
    title: "컨테이너 주문 관리",
    subtitle: "제품 관리 · 구매 주문 등록 · 구매 내역 조회",
  },
  lang: {
    label: "언어",
    ko: "한국어",
    en: "English",
  },
  tabs: {
    products: "제품 관리",
    purchase: "구매/컨테이너 주문 등록",
    history: "구매 내역 조회",
  },
  common: {
    close: "닫기",
    loading: "불러오는 중...",
    delete: "삭제",
    subtotal: "소계",
    total: "합계",
    quantity: "수량",
    unitPrice: "단가",
    duty: "관세",
    tax: "세금",
    rate: "Rate",
    selectItem: "품목 선택",
    item: "품목",
    noData: "-",
  },
  products: {
    listTitle: "제품 목록",
    listCount: "등록된 제품 {count}건",
    filteredCount: "조회 결과 {count}건",
    searchPlaceholder: "품목 ID로 검색",
    rateSearchPlaceholder: "Rate로 검색 (예: 1.25)",
    searchHint: "조회 시 각 제품의 최근 PO 번호가 함께 표시됩니다.",
    latestPo: "최근 PO",
    noLatestPo: "없음",
    exportExcel: "엑셀 내보내기",
    exportFilename: "제품조회결과",
    actions: "작업",
    purchaseHistory: "구매 내역",
    purchaseHistoryTitle: "{itemId} 구매 내역",
    noPurchaseHistory: "구매 내역이 없습니다.",
    empty: "등록된 제품이 없습니다.",
    newTitle: "신규 제품 등록",
    editTitle: "제품 수정",
    newHint: "품목 ID는 고유값으로 입력해주세요.",
    editHint: "품목 ID는 변경할 수 없습니다.",
    itemId: "품목 ID",
    description: "설명",
    packaging: "포장",
    price: "단가",
    itemIdPlaceholder: "예: ITEM-001",
    descriptionPlaceholder: "제품 설명",
    packagingPlaceholder: "예: 20kg/bag",
    registerBtn: "제품 등록",
    saveBtn: "변경 저장",
    cancelEdit: "취소",
    editBtn: "수정",
    registering: "등록 중...",
    saving: "저장 중...",
    registered: "제품이 등록되었습니다.",
    updated: "제품 정보가 수정되었습니다.",
  },
  purchase: {
    orderInfo: "구매/컨테이너 주문 정보",
    poNo: "PO 번호",
    orderDate: "주문일",
    containerNo: "컨테이너 번호",
    invoiceNo: "Invoice 번호",
    invoiceDate: "Invoice 날짜",
    totalAmountAuto: "총 금액",
    totalAmountPending: "엑셀 업로드 후 자동 계산",
    saveMaster: "마스터 저장",
    savingMaster: "저장 중...",
    masterSaved: "PO {poNo} 마스터가 등록되었습니다. 엑셀로 품목을 추가해주세요.",
    masterDesc: "PO 마스터 정보를 입력하고 저장하세요. 품목은 아래 엑셀 업로드로 추가합니다.",
    excelTitle: "엑셀 일괄 등록",
    excelDesc:
      "1단계: PO 마스터 저장 → 2단계: 엑셀 업로드. products에 없는 item_no는 신규 등록, 있는 item_no는 unit_price·duty·tax·rate를 업데이트합니다.",
    excelUploadHint:
      "등록된 PO를 선택한 후 엑셀 파일을 업로드하세요. 업로드 시 해당 PO의 기존 품목은 삭제되고 엑셀 내용으로 새로 등록됩니다. (1행 헤더, 2행부터 데이터)",
    excelColumns:
      "컬럼 순서 (A~H): item_no · description · packaging · quantity · unit_price · duty · tax · rate",
    targetPo: "대상 PO 번호",
    selectPo: "PO 선택",
    excelFile: "엑셀 파일 (.xlsx, .xls, .csv)",
    recentPoSaved:
      "최근 저장된 PO: {poNo} — 엑셀 업로드 대상으로 자동 선택되었습니다.",
    excelNoData:
      "엑셀에서 유효한 품목 데이터를 찾지 못했습니다. 1행 헤더, 2행부터 8개 컬럼을 확인해주세요.",
    excelUploadFailed: "엑셀 업로드에 실패했습니다.",
    excelSuccess: "엑셀에서 {count}건의 품목이 PO {poNo}에 추가되었습니다. 총 금액: {total}",
    excelAutoProducts: " (신규 제품 {count}건 자동 등록)",
    excelUpdatedProducts: " (기존 제품 {count}건 unit_price·duty·tax·rate 업데이트)",
    excelDutyTaxOnRecordOnly:
      " (products 테이블에 duty/tax 컬럼 없음 — PO 품목에만 duty/tax 저장됨)",
    deleteItem: "품목 삭제",
  },
  history: {
    title: "구매 내역",
    hint: "PO를 클릭하면 상세 품목 목록이 펼쳐집니다.",
    empty: "등록된 구매 내역이 없습니다.",
    loadingItems: "품목 불러오는 중...",
    noItems: "등록된 품목이 없습니다.",
    poNo: "PO 번호",
    orderDate: "주문일",
    container: "컨테이너",
    invoice: "Invoice",
    totalAmount: "총 금액",
    itemId: "품목 ID",
    description: "설명",
    deletePo: "삭제",
    deleteConfirm:
      "PO {poNo} 주문을 삭제하시겠습니까? 연결된 품목(purchase_record)도 함께 삭제됩니다.",
    deleteSuccess: "PO {poNo} 주문이 삭제되었습니다.",
    deleteFailed: "주문 삭제에 실패했습니다.",
    deleting: "삭제 중...",
  },
} as const;

const en = {
  app: {
    title: "Container Order Management",
    subtitle: "Products · Purchase Orders · Order History",
  },
  lang: {
    label: "Language",
    ko: "한국어",
    en: "English",
  },
  tabs: {
    products: "Product Management",
    purchase: "Purchase / Container Orders",
    history: "Order History",
  },
  common: {
    close: "Close",
    loading: "Loading...",
    delete: "Delete",
    subtotal: "Subtotal",
    total: "Total",
    quantity: "Qty",
    unitPrice: "Unit Price",
    duty: "Duty",
    tax: "Tax",
    rate: "Rate",
    selectItem: "Select item",
    item: "Item",
    noData: "-",
  },
  products: {
    listTitle: "Product List",
    listCount: "{count} product(s) registered",
    filteredCount: "{count} result(s)",
    searchPlaceholder: "Search by item ID",
    rateSearchPlaceholder: "Search by rate (e.g. 1.25)",
    searchHint: "Search results include the most recent PO number for each product.",
    latestPo: "Latest PO",
    noLatestPo: "None",
    exportExcel: "Export to Excel",
    exportFilename: "product-search-results",
    actions: "Actions",
    purchaseHistory: "Purchase History",
    purchaseHistoryTitle: "Purchase history — {itemId}",
    noPurchaseHistory: "No purchase history for this product.",
    empty: "No products registered.",
    newTitle: "Register New Product",
    editTitle: "Edit Product",
    newHint: "Item ID must be unique.",
    editHint: "Item ID cannot be changed.",
    itemId: "Item ID",
    description: "Description",
    packaging: "Packaging",
    price: "Unit Price",
    itemIdPlaceholder: "e.g. ITEM-001",
    descriptionPlaceholder: "Product description",
    packagingPlaceholder: "e.g. 20kg/bag",
    registerBtn: "Register Product",
    saveBtn: "Save Changes",
    cancelEdit: "Cancel",
    editBtn: "Edit",
    registering: "Registering...",
    saving: "Saving...",
    registered: "Product registered successfully.",
    updated: "Product updated successfully.",
  },
  purchase: {
    orderInfo: "Purchase / Container Order Info",
    poNo: "PO Number",
    orderDate: "Order Date",
    containerNo: "Container No.",
    invoiceNo: "Invoice No.",
    invoiceDate: "Invoice Date",
    totalAmountAuto: "Total Amount",
    totalAmountPending: "Calculated after Excel upload",
    saveMaster: "Save Master",
    savingMaster: "Saving...",
    masterSaved: "PO {poNo} master registered. Add line items via Excel.",
    masterDesc: "Enter PO master details and save. Add line items via Excel upload below.",
    excelTitle: "Bulk Excel Upload",
    excelDesc:
      "Step 1: Save PO master → Step 2: Upload Excel. New item_no is inserted; existing items get unit_price, duty, tax, and rate updated.",
    excelUploadHint:
      "Select a PO and upload Excel. Existing line items for that PO are deleted and replaced with the file contents. (Row 1 = header, data from row 2)",
    excelColumns:
      "Column order (A–H): item_no · description · packaging · quantity · unit_price · duty · tax · rate",
    targetPo: "Target PO Number",
    selectPo: "Select PO",
    excelFile: "Excel file (.xlsx, .xls, .csv)",
    recentPoSaved:
      "Recently saved PO: {poNo} — auto-selected for Excel upload.",
    excelNoData:
      "No valid line items found. Row 1 = header; from row 2 use 8 columns: item_no, description, packaging, quantity, unit_price, duty, tax, rate.",
    excelUploadFailed: "Excel upload failed.",
    excelSuccess: "{count} item(s) added to PO {poNo} from Excel. Total: {total}",
    excelAutoProducts: " ({count} new product(s) auto-registered)",
    excelUpdatedProducts: " ({count} existing product(s) updated: unit_price, duty, tax, rate)",
    excelDutyTaxOnRecordOnly:
      " (products table has no duty/tax columns — duty/tax saved on PO lines only)",
    deleteItem: "Delete item",
  },
  history: {
    title: "Order History",
    hint: "Click a PO to expand line item details.",
    empty: "No purchase orders registered.",
    loadingItems: "Loading items...",
    noItems: "No line items registered.",
    poNo: "PO Number",
    orderDate: "Order Date",
    container: "Container",
    invoice: "Invoice",
    totalAmount: "Total Amount",
    itemId: "Item ID",
    description: "Description",
    deletePo: "Delete",
    deleteConfirm:
      "Delete PO {poNo}? All linked line items (purchase_record) will also be removed.",
    deleteSuccess: "PO {poNo} deleted successfully.",
    deleteFailed: "Failed to delete purchase order.",
    deleting: "Deleting...",
  },
} as const;

export type TranslationKey = keyof typeof ko;

export const translations = { ko, en } as const;

export type Messages = typeof ko;

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : path;
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let text = getNestedValue(
    translations[locale] as unknown as Record<string, unknown>,
    key,
  );

  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${param}\\}`, "g"), String(value));
    }
  }

  return text;
}
