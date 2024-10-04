/**
 * Mentions United Renderer plugin for displaying a total number of Interactions
 * as text or anchor to jump to interaction list
 * 
 * @author Kristof Zerbe
 * @version 1.0.1
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * Options:
 *  - {String} placeholderId    = ID of the element which will be replaced by the generated HTML
 *  - {String} [pageKey]        = Unique identifier of the page, e.g. slug, for caching feature
 *  - {String} [anchorTargetId] = ID of the element to jump to on click for rendering as anchor
 *  - {Callback} [afterRender]  = Function to call after the generated HTML was inserted into the page
 */
class MentionsUnitedRenderer_TotalNumber extends MentionsUnited.Renderer {
  key = "total-number"; // must be unique across all renderer plugins for registration

  options = { 
    placeholderId: "",
    pageKey: "",
    anchorTargetId: "",
    afterRender: undefined
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();
  
    //check mandatory options
    if (this.options.placeholderId.length === 0) { throw "'placeholderId' is missing"; }    
  }

  /**
   * Renders the total number anchor
   * @param {Array.<MentionsUnited.Interaction>} interactions
   */
  render(interactions) {

    //nothing to show here -> exit
    if (interactions.length === 0) { return; } 

    //set and check placeholder where the anchor element will be inserted
    let placeholder = document.getElementById(this.options.placeholderId);
    if (!placeholder) { throw "No placeholder defined to replace with the total number anchor"; }

    //check interaction count from last visit and calculate delta, if necessary
    let delta = 0;

    if (this.options.pageKey.length > 0) {
      const storeKey = "ia-" + this.options.pageKey;
      let lastVisit = 0;
      if (localStorage.getItem(storeKey)) {
        lastVisit = localStorage.getItem(storeKey);
      } else {
        lastVisit = interactions.length; //for first visit
      }
      if (interactions.length !== lastVisit) {
        delta = (interactions.length - lastVisit);
      }
      localStorage.setItem(storeKey, interactions.length);    
    }
    
    const templates = new this.#Templates(this.helper);

    let data = {
      count: interactions.length,
      delta: delta,
      anchorTargetId: this.options.anchorTargetId
    }

    //get template HTML and convert to element
    let html = (this.options.anchorTargetId) ? templates.anchor(data) : templates.text(data);
    let element = this.helper.createElementFromHtml(html);

    placeholder.replaceWith(element);

    //call afterRender callback, if defined
    if (typeof this.options.afterRender === "function") {
      this.options.afterRender();
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Template class to hold methods for composing the HTML
   */
  #Templates = class Templates {

    constructor(helper) {
      this.helper = helper;
    }

    /**
     * Composes the anchor with text content
     * @param {Object} data
     * @returns {String}
     */
    anchor(data) {
      return this.helper.fillLiteralTemplate(
        `
        <a href="#${data.anchorTargetId}" class="interactions-totalnumber">
          ${this.#part_content(data)}
        </a>
        `,
        data
      );
    }

    /**
     * Composes a wrapper with text content only
     * @param {Object} data
     * @returns {String}
     */
    text(data) {
      return this.helper.fillLiteralTemplate(
        `
        <div class="interactions-totalnumber">
          ${this.#part_content(data)}
        </div>
        `,
        data
      );
    }

    /**
     * Template part for the content
     * @param {Object} data
     * @returns {String}
     */
    #part_content(data) {
      return this.helper.fillLiteralTemplate(
        `
        <span>${data.count} Interaction${(data.count) === 1 ? "" : "s"}</span>
        ${(data.delta !== 0) ? this.#part_delta(data) : "" }
        `,
        data
      );
    }

    /**
     * Template part for the delta of last visit
     * @param {Object} data 
     */
    #part_delta(data) {
      return this.helper.fillLiteralTemplate(
        `
        <span class="delta">${data.delta < 0 ? "-" : "+"} ${Math.abs(data.delta)}</span>
        `,
        data
      );  
    }

  }

}
/**
 * Changelog
 * 
 * 1.0.0  - Initial
 * 1.0.1  - Support for negative numbers and dedicated number sign
 */