"use client";

export default function TimeSlotGrid({ timeSlots, selectedTime, onSelect, isDisabled = false }) {
    const isPastTime = (time) => {
        if (!time) return false;
        
        const now = new Date();
        const today = now.toDateString();
        const selected = new Date().toDateString();
        
        // ถ้าไม่ใช่วันนี้ ไม่ต้องเช็คเวลา
        if (today !== selected) return false;
        
        const [hours, minutes] = time.split(':').map(Number);
        const timeDate = new Date();
        timeDate.setHours(hours, minutes, 0, 0);
        
        return timeDate < now;
    };

    return (
        <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 ${isDisabled ? 'opacity-50' : ''}`}>
            {timeSlots.length === 0 ? (
                <div className="col-span-4 text-center text-gray-500 py-2">
                    ไม่พบช่วงเวลาที่ว่าง
                </div>
            ) : (
                timeSlots.map(time => {
                    const past = isPastTime(time);
                    return (
                        <button
                            key={time}
                            type="button"
                            onClick={() => {
                                if (past) {
                                    window.alert('ไม่สามารถเลือกเวลาที่ผ่านไปแล้ว');
                                    return;
                                }
                                onSelect(time);
                            }}
                            disabled={isDisabled || past}
                            className={`p-2 text-center rounded-md transition-colors ${
                                selectedTime === time
                                    ? 'bg-indigo-600 text-white'
                                    : past
                                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                        : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                        >
                            {time}
                        </button>
                    );
                })
            )}
        </div>
    );
}

