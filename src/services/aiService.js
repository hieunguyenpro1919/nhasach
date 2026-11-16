/**
 * Service quản lý kết nối Google Gemini API
 * Hỗ trợ Lightweight RAG (Retrieval-Augmented Generation) cho Nhà Sách Trí Tuệ
 */

// GẮN KEY TẠI ĐÂY NẾU MUỐN DÙNG MẶC ĐỊNH TRONG CODE (hoặc nhập trên giao diện qua nút ⚙️):
const DEFAULT_GEMINI_KEY = import.meta?.env?.VITE_GEMINI_API_KEY || ''; 

const STORAGE_KEY = 'TRITUE_GEMINI_API_KEY';

// Danh sách các model ưu tiên thử theo thứ tự nhanh nhất (Flash 2.5/2.0/1.5)
const PREFERRED_MODELS = [
    { name: 'gemini-2.5-flash', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1beta' },
    { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
    { name: 'gemini-1.5-pro', version: 'v1beta' }
];

export const aiService = {
    cachedValidModels: null,

    /**
     * Lấy API Key hiện tại từ localStorage hoặc từ key mặc định
     */
    getApiKey() {
        return localStorage.getItem(STORAGE_KEY) || DEFAULT_GEMINI_KEY || '';
    },

    /**
     * Lưu API Key vào localStorage
     * @param {string} key 
     */
    setApiKey(key) {
        this.cachedValidModels = null;
        if (!key) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, key.trim());
        }
    },

    /**
     * Kiểm tra xem đã có API Key hợp lệ chưa
     */
    hasApiKey() {
        const key = this.getApiKey();
        return Boolean(key && key.length > 10);
    },

    /**
     * Lấy danh sách model để gọi (ưu tiên Flash 2.5/2.0/1.5 trực tiếp để phản hồi dưới 1 giây)
     */
    async fetchAvailableModels(apiKey) {
        if (this.cachedValidModels && this.cachedValidModels.length > 0) {
            return this.cachedValidModels;
        }

        // Ưu tiên trả về ngay danh sách model Flash chuẩn quốc tế để tránh việc phải gọi thêm 1 round-trip fetch model gây lag
        return PREFERRED_MODELS;
    },

    /**
     * Kiểm tra tính hợp lệ của API Key bằng một truy vấn nhẹ test trực tiếp vào model
     */
    async testApiKey(key) {
        const cleanKey = (key || this.getApiKey()).trim();
        if (!cleanKey) return { ok: false, message: 'Chưa nhập API Key' };

        // Test trực tiếp endpoint generateContent với prompt nhỏ 'ping'
        for (const target of PREFERRED_MODELS) {
            try {
                const endpoint = `https://generativelanguage.googleapis.com/${target.version}/models/${target.name}:generateContent?key=${cleanKey}`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
                        generationConfig: { maxOutputTokens: 5 }
                    })
                });

                if (res.ok) {
                    this.cachedValidModels = [target, ...PREFERRED_MODELS.filter(m => m.name !== target.name)];
                    return {
                        ok: true,
                        message: `Kết nối thành công tới Google Gemini (${target.name})!`
                    };
                }

                const errJson = await res.json().catch(() => ({}));
                const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
                if (res.status === 400 && errMsg.includes('API_KEY_INVALID')) {
                    return { ok: false, message: 'Mã API Key không hợp lệ (API_KEY_INVALID). Hãy kiểm tra lại key từ Google AI Studio.' };
                }
            } catch (err) {
                // Thử model kế tiếp
            }
        }

        return {
            ok: false,
            message: 'Không thể kết nối tới Gemini API với key này. Vui lòng kiểm tra lại kết nối mạng hoặc đổi key mới.'
        };
    },

    /**
     * Gọi Gemini API để sinh câu trả lời với ngữ cảnh danh mục sách (Lightweight RAG)
     * @param {string} userMessage Tin nhắn từ người dùng
     * @param {Array} books Danh sách sách từ kho để nạp ngữ cảnh
     * @param {Array} chatHistory Lịch sử trò chuyện gần nhất [{ role: 'user'|'model', text: string }]
     */
    async generateResponse(userMessage, books = [], chatHistory = []) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('CHUA_CO_KEY');
        }

        // 1. Chuẩn bị ngữ cảnh danh mục sách (Lightweight RAG Context - giới hạn 15 cuốn tiêu biểu để prompt gọn nhẹ và AI trả lời siêu tốc)
        const booksSummary = books.slice(0, 15).map(b => {
            const saleInfo = b.onSale ? ` (SALE -${b.discountPercent || 20}%)` : '';
            return `- "${b.name}" (${Number(b.price).toLocaleString('vi-VN')}₫${saleInfo}) - ${b.author || 'Tác giả'}`;
        }).join('\n');

        // 2. Xây dựng System Prompt chuyên nghiệp
        const systemPromptText = `
Bạn là "Trợ lý AI Nhà Sách Trí Tuệ". Hãy tư vấn và gợi ý sách thân thiện, ngắn gọn (2-3 đoạn ngắn) cho khách hàng.
Dưới đây là một số sách tiêu biểu của nhà sách:
${booksSummary}
Ưu tiên gợi ý sách có trong danh mục trên kèm giá tiền. Kết thúc bằng câu hỏi mở hoặc lời chúc.
`;

        // 3. Chuẩn bị nội dung gửi lên API
        const formattedHistory = chatHistory.slice(-4).map(item => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text }]
        }));

        // Gộp system prompt vào lời chào đầu tiên hoặc tin nhắn hiện tại để 100% model đều tương thích
        const unifiedContents = [
            ...formattedHistory,
            {
                role: 'user',
                parts: [{ text: `[HƯỚNG DẪN HỆ THỐNG VÀ KHO SÁCH NHÀ SÁCH TRÍ TUỆ]:\n${systemPromptText}\n\n[CÂU HỎI CỦA KHÁCH HÀNG]:\n${userMessage}` }]
            }
        ];

        // 4. Lấy danh sách model thực tế mà Google cấp cho API key này
        const targetModels = await this.fetchAvailableModels(apiKey);
        let lastError = null;

        for (const target of targetModels) {
            try {
                const endpoint = `https://generativelanguage.googleapis.com/${target.version}/models/${target.name}:generateContent?key=${apiKey}`;
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: unifiedContents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 800
                        }
                    })
                });

                if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    const errMsg = errJson.error ? errJson.error.message : `HTTP ${response.status}`;
                    console.warn(`Model ${target.name} (${target.version}) báo lỗi:`, errMsg);

                    if (response.status === 400 && errMsg.includes('API_KEY_INVALID')) {
                        throw new Error(`API_KEY_ERROR: Mã API Key không hợp lệ. Vui lòng kiểm tra lại key.`);
                    }

                    lastError = new Error(errMsg);
                    continue; // thử model tiếp theo trong danh sách
                }

                const data = await response.json();
                const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (replyText) {
                    console.log(`✓ AI đã trả lời thành công bằng model: ${target.name} (${target.version})`);
                    return replyText;
                }
            } catch (err) {
                if (err.message && err.message.startsWith('API_KEY_ERROR')) {
                    throw err;
                }
                lastError = err;
            }
        }

        throw lastError || new Error('Không nhận được phản hồi từ AI');
    }
};
