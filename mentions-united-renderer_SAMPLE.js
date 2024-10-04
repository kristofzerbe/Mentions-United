/**
 * Sample for a Mentions United Renderer plugin for displaying Interactions in your way
 * 
 * @author <YOUR-NAME>
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * It would be wonderful of you open up a PR here to let me add your plugin to the project
 * 
 * Options:
 *  - {String} placeholderId   = for example an ID of the element which will be replaced
 *  - {Callback} [afterRender] = JS function to call after render
 */
class MentionsUnitedRenderer_NAME extends MentionsUnited.Renderer {
  key = "__RENDERER__"; // must be unique across all renderer plugins for registration

  options = { 
    placeholderId: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.placeholderId.length === 0) { throw "'placeholderId' is missing"; }
  }

  /**
   * Renders the element regarding Interactions
   * @param {Array.<MentionsUnited.Interaction>} interactions 
   */
  render(interactions) {

    //set and check placeholder where the element will be inserted
    let placeholder = document.getElementById(this.options.placeholderId);
    if (!placeholder) { throw "No placeholder defined to replace with ..."; }
    
    const templates = new this.#Templates(this.helper);

    //... do something with the interactions, for example:
    let result = this.helper.createElementFromHtml("<div></div>");
    for (let ia of interactions) {
      //call your template method to get the HTML and convert to element
      let html = templates.MY_TEMPLATE_FUNCTION(ia);
      let element = this.helper.createElementFromHtml(html);
      result.appendChild(element);
    }

    //replace placeholder with result element
    placeholder.replaceWith(result);

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
     * Composes an Interaction element ... fo example 'like from John Doe'
     * @param {MentionsUnited.Interaction} ia
     * @returns {String}
     */
    MY_TEMPLATE_FUNCTION(ia) {
      return this.helper.fillLiteralTemplate(
        `
        <span>${ia.type} from ${ia.author.name}</span>
        `,
        ia
      );
    }

  }

}
/**
 * Changelog
 * 
 * 1.0.0  - Initial
 */