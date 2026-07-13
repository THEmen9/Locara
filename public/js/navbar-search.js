document.addEventListener("DOMContentLoaded", () => {

  const config = {
    mode: "range",
    minDate: "today",
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d M",
    rangeSeparator: " to ",
    showMonths: 2
  };

  flatpickr("#datePicker", config);
  flatpickr("#datePickerCompact", config);

});
