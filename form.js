/*
  form.js - CSE 134B HW4 Part 3
  Author: Christos-Iason Enotiadis
  Enhances the contact form on form-with-js.html: specific validation messages,
  an error area, a character count and a history of failed submission attempts.
  The form still validates and submits with plain HTML if this file never runs.
*/

const contactForm = document.querySelector('form[action="https://httpbin.org/post"]');
const nameField = document.querySelector("#name");
const emailField = document.querySelector("#email");
const commentsField = document.querySelector("#comments");
const contactFields = [nameField, emailField, commentsField];

const errorArea = document.querySelector("#error-area");
const infoArea = document.querySelector("#info-area");
const charCount = document.querySelector("#char-count");
const charStatus = document.querySelector("#char-status");

const WARNING_THRESHOLD = 100;

// error history - one entry per invalid field per failed submission attempt
const form_errors = [];

// field names shown in the error area
const fieldLabels = {
  name: "Name",
  email: "Email",
  comments: "Message"
};

// messages for empty required fields
const missingMessages = {
  name: "Enter your name.",
  email: "Enter your email address so I can reply.",
  comments: "Write a message of at least 10 characters."
};

// per field state - edited: user has typed, shown: errors visible
const fieldState = {
  name: { edited: false, shown: false },
  email: { edited: false, shown: false },
  comments: { edited: false, shown: false }
};

// fields already recorded in the current submission attempt
let recordedThisAttempt = [];


// validation - work out what is wrong with a field, or null if nothing
function findProblem(field) {
  const validity = field.validity;
  const length = field.value.length;

  if (validity.valueMissing) {
    return { error: "missing", message: missingMessages[field.id] };
  }
  if (validity.typeMismatch) {
    return { error: "invalid email format", message: "Enter an email address in the format name@example.com." };
  }
  if (validity.tooShort || (length > 0 && length < field.minLength)) {
    return { error: "too short", message: `Write at least ${field.minLength} characters.` };
  }
  return null;
}

// validation - clear the old custom message, then set a new one if needed
function checkField(field) {
  field.setCustomValidity("");
  const problem = findProblem(field);
  if (problem) {
    field.setCustomValidity(problem.message);
  }
  return problem;
}


// error area - heading plus one hidden list item per field, built once
function buildErrorArea() {
  const heading = document.createElement("p");
  heading.textContent = "Fix these before sending:";

  const list = document.createElement("ul");
  for (const field of contactFields) {
    const item = document.createElement("li");
    item.id = field.id + "-error";
    item.hidden = true;

    const link = document.createElement("a");
    link.href = "#" + field.id;
    link.textContent = fieldLabels[field.id];

    const message = document.createElement("span");
    item.append(link, ": ", message);
    list.append(item);
  }

  errorArea.append(heading, list);
}

// error area - show, update or hide one field's entry
function showFieldError(field, problem) {
  if (problem && errorArea.childElementCount === 0) {
    buildErrorArea();
  }

  const item = document.getElementById(field.id + "-error");
  if (item) {
    if (problem) {
      const message = item.querySelector("span");
      if (message.textContent !== problem.message) {
        message.textContent = problem.message;
      }
      item.hidden = false;
    } else {
      item.hidden = true;
    }
  }

  // empty the area entirely once every entry is hidden
  if (errorArea.querySelector("li:not([hidden])") === null) {
    errorArea.replaceChildren();
  }

  updateDescribedBy(field, problem !== null && fieldState[field.id].shown);
}

// aria-describedby - hint, character count for comments, error when visible
function updateDescribedBy(field, hasVisibleError) {
  const ids = [field.id + "-hint"];
  if (field === commentsField) {
    ids.push("char-count");
  }
  if (hasVisibleError) {
    ids.push(field.id + "-error");
  }
  field.setAttribute("aria-describedby", ids.join(" "));
}

// recheck a field and update what the user sees
function refreshField(field) {
  const problem = checkField(field);
  showFieldError(field, fieldState[field.id].shown ? problem : null);
  return problem;
}


// error history - record each invalid field once per submission attempt
function recordFailedField(field, problem) {
  if (recordedThisAttempt.length === 0) {
    // attempt ends once the browser has fired this round of invalid events
    setTimeout(function () {
      recordedThisAttempt = [];
    }, 0);
  }
  if (recordedThisAttempt.includes(field.id)) {
    return;
  }
  recordedThisAttempt.push(field.id);

  form_errors.push({
    field: field.name,
    error: problem ? problem.error : field.validationMessage
  });
}


// character count - remaining characters, warning and limit messages
function updateCharacterCount() {
  const limit = commentsField.maxLength;
  const remaining = limit - commentsField.value.length;
  const unit = remaining === 1 ? "character" : "characters";
  charCount.textContent = `Message length: ${remaining.toLocaleString("en-US")} ${unit} left.`;

  let state = "normal";
  if (remaining <= 0) {
    state = "limit";
  } else if (remaining <= WARNING_THRESHOLD) {
    state = "warning";
  }

  // status line - only changes when the state changes, so screen readers hear it once
  if (infoArea.dataset.state !== state) {
    infoArea.dataset.state = state;
    if (state === "limit") {
      charStatus.textContent = `Character limit reached: messages can be up to ${limit.toLocaleString("en-US")} characters.`;
    } else if (state === "warning") {
      charStatus.textContent = `Nearly at the limit: ${WARNING_THRESHOLD} characters or fewer left.`;
    } else {
      charStatus.textContent = "";
    }
  }
}


// events - typing, pasting and deleting
for (const field of contactFields) {
  field.addEventListener("input", function () {
    fieldState[field.id].edited = true;
    refreshField(field);
    if (field === commentsField) {
      updateCharacterCount();
    }
  });

  // events - leaving a field the user has edited
  field.addEventListener("blur", function () {
    if (fieldState[field.id].edited) {
      fieldState[field.id].shown = true;
      refreshField(field);
    }
  });
}

// events - failed submission, button or keyboard (invalid does not bubble, so capture)
contactForm.addEventListener("invalid", function (event) {
  const field = event.target;
  if (!contactFields.includes(field)) {
    return;
  }
  fieldState[field.id].shown = true;
  const problem = refreshField(field);
  recordFailedField(field, problem);
}, true);

// events - successful submission, add the serialised history
contactForm.addEventListener("submit", function () {
  let historyField = contactForm.querySelector('input[name="form-errors"]');
  if (!historyField) {
    historyField = document.createElement("input");
    historyField.type = "hidden";
    historyField.name = "form-errors";
    contactForm.append(historyField);
  }
  historyField.value = JSON.stringify(form_errors);
});


// setup - custom messages ready before the first submit, counter visible
for (const field of contactFields) {
  checkField(field);
  updateDescribedBy(field, false);
}
updateCharacterCount();
infoArea.hidden = false;
