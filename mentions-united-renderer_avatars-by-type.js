/**
 * Mentions United Renderer plugin for displaying Interactions of specific type as avatars only
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * Options:
 *  - {String} placeholderId   = ID of the element which will be replaced by the generated HTML
 *  - {String} typeVerb        = Type verb for filtering the interactions and to show as avatars ... like, repost or else
 *  - {Callback} [afterRender] = Function to call after the generated HTML was inserted into the page
 */
class MentionsUnitedRenderer_AvatarsByType extends MentionsUnited.Renderer {
  key = "avatars-by-type"; // must be unique across all renderer plugins for registration

  options = {
    placeholderId: "",
    typeVerb: "",
    afterRender: undefined
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.placeholderId.length === 0) { throw "'placeholderId' is missing"; }
    if (this.options.typeVerb.length === 0) { throw "'typeVerb' is missing"; }

    //for multiple usage of the plugin, add typeVerb to the key
    this.key += `-${this.options.typeVerb.toLowerCase()}`;
  }

  /**
   * Renders the list of avatars for interaction type
   * @param {Array.<MentionsUnited.Interaction>} interactions
   */
  render(interactions) {

    //set and check placeholder where the element will be inserted
    let placeholder = document.getElementById(this.options.placeholderId);
    if (!placeholder) { throw "No placeholder defined to replace with avatars"; }

    //filter the needed interactions by given type
    const typeInteractions = interactions.filter(ia => {
      return ia.type.toLowerCase() === this.options.typeVerb.toLowerCase();
    })

    //nothing to show here -> exit
    if (typeInteractions.length === 0) { 
      placeholder.remove();
      return; 
    } 

    const templates = new this.#Templates(this.helper);

    let listHtml = templates.avatar_list({
      typeVerbPlural: this.#getPluralType(this.options.typeVerb)
    });
    let listElement = this.helper.createElementFromHtml(listHtml);

    for (let ia of typeInteractions) {
      let html = templates.avatar(ia);
      let element = this.helper.createElementFromHtml(html);
      
      listElement.appendChild(element);
    }

    placeholder.replaceWith(listElement);

    //call afterRender callback, if defined
    if (typeof this.options.afterRender === "function") {
      this.options.afterRender();
    }
  }

  /**
   * Determines the plural word of a type verb
   * @param {String} type 
   * @returns {String}
   */
  #getPluralType(type) {
    switch (type) {
      case "reply": return "replies";  
      default: return type + "s";
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
     * Composes a wrapper for the avatars with a caption for type
     * @param {MentionsUnited.Interaction} ia
     * @returns {String}
     */
    avatar_list(data) {
      return this.helper.fillLiteralTemplate(
        `
        <div class="interactions-avatars type-${data.typeVerbPlural.toLowerCase()}">
          <h3>${data.typeVerbPlural}</h3>
        </div>
        `,
        data
      );
    }

    /**
     * Composes an avatar
     * @param {MentionsUnited.Interaction} ia 
     */
    avatar(ia) {
      return this.helper.fillLiteralTemplate(
        `
        <a class="avatar origin-${ia.source.origin}" 
           href="${ia.author.profile ?? ""}" 
           title="${ia.author.name} on ${this.helper.capitalize(ia.source.origin)}">
          <img src="${ia.author.avatar}" alt="${ia.author.name}" width="16px" height="16px" />
        </a>
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