document.addEventListener("DOMContentLoaded", () => {

  const config = {
    mode: "range",
    minDate: "today",
    dateFormat: "d M",
    showMonths: 2
  };

  flatpickr("#datePicker", config);
  flatpickr("#datePickerCompact", config);

});